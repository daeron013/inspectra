import crypto from "node:crypto";
import { toObjectId } from "../db.js";
import { normalizeForMongo, serializeDoc } from "../qms.js";
import { logAgentRun } from "../agent-runs.js";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the Inspection Agent for an ISO 13485 medical device QMS.

Your job is to analyze incoming inspection records and decide whether they indicate a quality problem.

You have three tools:
- get_inspection: fetch full inspection details including lot, part, and supplier data
- flag_anomaly: mark the inspection as anomalous with a reason (call this when defects exceed acceptable limits)
- create_ncr: open a nonconformance report (call this when the defect rate exceeds 4% OR any critical defect is found)

Decision rules:
1. Defect rate = defects_found / sample_size
2. If defect_rate > 0.04 (4%) → flag anomaly AND create NCR with severity "major"
3. If defect_rate > 0 but <= 0.04 → flag anomaly only, severity "minor"
4. If defect_rate == 0 → take no action, inspection passes
5. Always explain your reasoning before calling a tool.

After completing your analysis, summarize what you found and what actions you took.`;

// --- Tool definitions (Gemini function calling format) ---

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_inspection",
        description: "Fetch full inspection details including the associated lot, part, and supplier.",
        parameters: {
          type: "OBJECT",
          properties: {
            inspection_id: {
              type: "STRING",
              description: "The MongoDB ObjectId of the inspection to fetch.",
            },
          },
          required: ["inspection_id"],
        },
      },
      {
        name: "flag_anomaly",
        description: "Mark an inspection as anomalous. Call this when defects are found.",
        parameters: {
          type: "OBJECT",
          properties: {
            inspection_id: {
              type: "STRING",
              description: "The MongoDB ObjectId of the inspection.",
            },
            reason: {
              type: "STRING",
              description: "Human-readable explanation of why this inspection is anomalous.",
            },
            defect_rate: {
              type: "NUMBER",
              description: "Calculated defect rate as a decimal (e.g. 0.06 for 6%).",
            },
            severity: {
              type: "STRING",
              enum: ["minor", "major", "critical"],
              description: "Severity of the anomaly.",
            },
          },
          required: ["inspection_id", "reason", "defect_rate", "severity"],
        },
      },
      {
        name: "create_ncr",
        description: "Create a nonconformance report for a failed inspection. Only call when defect rate exceeds 4% or a critical defect is found.",
        parameters: {
          type: "OBJECT",
          properties: {
            inspection_id: {
              type: "STRING",
              description: "The MongoDB ObjectId of the triggering inspection.",
            },
            title: {
              type: "STRING",
              description: "Short title for the NCR.",
            },
            description: {
              type: "STRING",
              description: "Detailed description of the nonconformance.",
            },
            severity: {
              type: "STRING",
              enum: ["minor", "major", "critical"],
              description: "NCR severity level.",
            },
          },
          required: ["inspection_id", "title", "description", "severity"],
        },
      },
    ],
  },
];

// --- Tool handlers (actually execute the tool calls against MongoDB) ---

async function handleGetInspection(db, userId, { inspection_id }) {
  const inspection = await db.collection("inspections").findOne({
    _id: toObjectId(inspection_id),
    user_id: userId,
  });

  if (!inspection) return { error: "Inspection not found" };

  const [lot, supplier] = await Promise.all([
    inspection.lot_id ? db.collection("lots").findOne({ _id: inspection.lot_id }) : null,
    inspection.supplier_id ? db.collection("suppliers").findOne({ _id: inspection.supplier_id }) : null,
  ]);

  const part = lot?.part_id ? await db.collection("parts").findOne({ _id: lot.part_id }) : null;

  return serializeDoc({ inspection, lot, part, supplier });
}

async function handleFlagAnomaly(db, userId, { inspection_id, reason, defect_rate, severity }) {
  await db.collection("inspections").updateOne(
    { _id: toObjectId(inspection_id), user_id: userId },
    {
      $set: {
        status: "failed",
        anomaly_flagged: true,
        anomaly_reason: reason,
        defect_rate,
        anomaly_severity: severity,
        updated_at: new Date().toISOString(),
      },
    },
  );
  return { flagged: true, inspection_id, severity };
}

async function handleCreateNcr(db, userId, { inspection_id, title, description, severity }, context) {
  const now = new Date().toISOString();

  const doc = normalizeForMongo({
    user_id: userId,
    ncr_number: `NCR-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title,
    description,
    severity,
    status: "open",
    source: "inspection_agent",
    lot_id: context.lot_id || null,
    part_id: context.part_id || null,
    supplier_id: context.supplier_id || null,
    inspection_id: toObjectId(inspection_id),
    disposition: null,
    root_cause: null,
    corrective_action: null,
    created_at: now,
    updated_at: now,
  });

  const result = await db.collection("ncrs").insertOne(doc);
  const created = await db.collection("ncrs").findOne({ _id: result.insertedId });
  return serializeDoc(created);
}

// --- Gemini agentic loop ---

async function runGeminiAgentLoop(db, userId, inspectionId) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;

  // Conversation history for the multi-turn tool-calling loop
  const contents = [
    {
      role: "user",
      parts: [{ text: `Analyze inspection ID: ${inspectionId}. Start by calling get_inspection to retrieve the full record, then decide what actions to take.` }],
    },
  ];

  const actionsLog = [];
  let contextCache = {}; // store lot/part/supplier IDs after get_inspection for use in create_ncr
  let finalSummary = "";

  // Loop until Gemini stops calling tools (max 10 turns to prevent runaway)
  for (let turn = 0; turn < 10; turn++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        tools: TOOLS,
        contents,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${text}`);
    }

    const json = await response.json();
    const candidate = json.candidates?.[0];
    if (!candidate) throw new Error("No candidate returned from Gemini");

    const parts = candidate.content?.parts || [];
    contents.push({ role: "model", parts });

    // Extract any text reasoning the model produced
    const textParts = parts.filter((p) => p.text).map((p) => p.text).join("\n");
    if (textParts) finalSummary = textParts;

    // Find function calls in this turn
    const functionCalls = parts.filter((p) => p.functionCall);
    if (functionCalls.length === 0) break; // no more tool calls — agent is done

    // Execute each tool call and feed results back
    const toolResults = [];
    for (const part of functionCalls) {
      const { name, args } = part.functionCall;
      let result;

      if (name === "get_inspection") {
        result = await handleGetInspection(db, userId, args);
        // Cache IDs for use in create_ncr
        if (result.lot) contextCache.lot_id = result.lot.id;
        if (result.part) contextCache.part_id = result.part.id;
        if (result.inspection?.supplier_id) contextCache.supplier_id = result.inspection.supplier_id;
        actionsLog.push({ tool: name, args, result });
      } else if (name === "flag_anomaly") {
        result = await handleFlagAnomaly(db, userId, args);
        actionsLog.push({ tool: name, args, result });
      } else if (name === "create_ncr") {
        result = await handleCreateNcr(db, userId, args, contextCache);
        actionsLog.push({ tool: name, args, result });
      } else {
        result = { error: `Unknown tool: ${name}` };
      }

      toolResults.push({
        functionResponse: {
          name,
          response: { content: result },
        },
      });
    }

    contents.push({ role: "user", parts: toolResults });
  }

  return { actionsLog, summary: finalSummary };
}

// --- Public entry point ---

export async function runInspectionAgent(db, userId, inspectionId) {
  const startedAt = Date.now();
  let result;

  try {
    result = await runGeminiAgentLoop(db, userId, inspectionId);
  } catch (err) {
    await logAgentRun(db, {
      userId,
      agentType: "inspection",
      triggerEvent: "inspection_submitted",
      inputData: { inspection_id: inspectionId },
      reasoning: "",
      actionTaken: "Agent failed to run",
      recordsAffected: [],
      confidence: 0,
      requiresHumanReview: true,
      status: "failed",
      error: err.message,
    });
    throw err;
  }

  const { actionsLog, summary } = result;
  const ncrAction = actionsLog.find((a) => a.tool === "create_ncr");
  const flagAction = actionsLog.find((a) => a.tool === "flag_anomaly");
  const recordsAffected = [
    inspectionId,
    ...(ncrAction?.result?.id ? [ncrAction.result.id] : []),
  ];

  const confidence = actionsLog.length > 0 ? 0.92 : 1.0;
  const requiresHumanReview = !!ncrAction; // NCR created → human should review

  await logAgentRun(db, {
    userId,
    agentType: "inspection",
    triggerEvent: "inspection_submitted",
    inputData: { inspection_id: inspectionId },
    reasoning: summary,
    actionTaken: ncrAction
      ? `Flagged anomaly and created NCR ${ncrAction.result?.ncr_number}`
      : flagAction
      ? "Flagged anomaly, defect rate below NCR threshold"
      : "Inspection passed — no action taken",
    recordsAffected,
    confidence,
    requiresHumanReview,
    status: "completed",
  });

  return {
    inspection_id: inspectionId,
    actions: actionsLog.map((a) => a.tool),
    ncr_created: ncrAction?.result || null,
    anomaly_flagged: !!flagAction,
    summary,
    duration_ms: Date.now() - startedAt,
  };
}
