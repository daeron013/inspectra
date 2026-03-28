import crypto from "node:crypto";
import { toObjectId } from "../db.js";
import { normalizeForMongo, serializeDoc } from "../qms.js";
import { logAgentRun } from "../agent-runs.js";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the CAPA Agent for an ISO 13485 / FDA 21 CFR 820.100 quality management system.

Your sole domain: nonconformance history, pattern detection, CAPA lifecycle, and engineering notifications.
You do NOT inspect lots, score suppliers, or manage compliance calendars.

Required workflow — always follow this order:
1. Call get_ncr_history to load recent NCRs.
2. Call get_open_capas to see what is already in progress (avoid duplicates).
3. Call detect_pattern to get severity-weighted clusters and trend signals.
4. Evaluate whether a NEW CAPA is warranted:
   - A new CAPA is warranted if: a pattern has severity_score >= 6, OR trend_flag is true, OR any NCR is critical with no open CAPA.
   - A new CAPA is NOT warranted if: an open CAPA already covers the same NCR cluster.
5. If warranted, call create_capa with linked NCR ids, root cause hypothesis, action plan, and priority.
6. If a CAPA was created or an urgent unaddressed pattern exists, call notify_engineer.

FDA 21 CFR 820.100 reminders:
- CAPA must address the root cause, not just symptoms.
- Effectiveness verification is required — always include in action_plan.
- Link all related NCRs for traceability.

Priority → due date mapping (use in create_capa):
  critical → 30 days, high → 60 days, medium → 90 days, low → 180 days

After completing, write a plain-language summary suitable for an auditor: what you found, what you did, and why.`;

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_ncr_history",
        description: "Fetch NCR records for this tenant. Always call this first.",
        parameters: {
          type: "OBJECT",
          properties: {
            days_back: { type: "NUMBER", description: "NCRs created in the last N days (default 365)." },
            status_filter: { type: "STRING", description: "Optional: open, investigating, closed." },
            limit: { type: "NUMBER", description: "Max NCRs to return (default 100)." },
          },
        },
      },
      {
        name: "get_open_capas",
        description: "Fetch all non-closed CAPAs (any age). Call before create_capa to avoid duplicates.",
        parameters: {
          type: "OBJECT",
          properties: {
            days_back: { type: "NUMBER", description: "Ignored; retained for backward compatibility." },
          },
        },
      },
      {
        name: "detect_pattern",
        description: [
          "Analyze NCR clusters using severity-weighted scoring and trend detection.",
          "Returns clusters by supplier, part, and title theme, each with a severity_score (sum of weights: critical=4, major=3, minor=2, other=1) and a trend_flag (true if the last 30-day window has more NCRs than the prior 30-day window for that cluster).",
          "Use severity_score and trend_flag — not just count — to decide if a CAPA is warranted.",
        ].join(" "),
        parameters: {
          type: "OBJECT",
          properties: {
            days_back: { type: "NUMBER", description: "Analysis window in days (default 180)." },
            min_cluster_size: { type: "NUMBER", description: "Minimum NCRs to form a pattern (default 2)." },
          },
        },
      },
      {
        name: "create_capa",
        description: "Create a corrective/preventive action linked to one or more NCRs. Only call if get_open_capas confirmed no duplicate exists.",
        parameters: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            description: { type: "STRING", description: "Scope and problem statement." },
            type: { type: "STRING", enum: ["corrective", "preventive"] },
            priority: { type: "STRING", enum: ["low", "medium", "high", "critical"] },
            ncr_ids: { type: "ARRAY", items: { type: "STRING" }, description: "MongoDB ObjectIds of all linked NCRs." },
            root_cause: { type: "STRING", description: "Root cause hypothesis. Reference specific evidence from NCR data." },
            action_plan: { type: "STRING", description: "Actions, responsible parties, and effectiveness verification method per 21 CFR 820.100." },
            assigned_to: { type: "STRING", description: "Owner name or email." },
            trigger_reason: { type: "STRING", description: "Why this CAPA was opened." },
          },
          required: ["title", "description", "type", "priority", "ncr_ids", "root_cause", "action_plan"],
        },
      },
      {
        name: "notify_engineer",
        description: "Log an engineering/quality notification for follow-up. Stored as an audit trail entry.",
        parameters: {
          type: "OBJECT",
          properties: {
            recipient_name: { type: "STRING" },
            recipient_email: { type: "STRING" },
            message: { type: "STRING" },
            urgency: { type: "STRING", enum: ["low", "medium", "high"] },
            capa_id: { type: "STRING" },
            ncr_numbers: { type: "ARRAY", items: { type: "STRING" } },
          },
          required: ["recipient_name", "message", "urgency"],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - Number(days || 365));
  return d.toISOString();
}

function dueDateFromPriority(priority) {
  const days = { critical: 30, high: 60, medium: 90, low: 180 }[priority] ?? 90;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function severityWeight(severity) {
  return { critical: 4, major: 3, minor: 2 }[severity?.toLowerCase()] ?? 1;
}

function normalizeTitleKey(title) {
  if (!title || typeof title !== "string") return "unknown";
  const STOPWORDS = new Set(["with", "from", "that", "this", "have", "been", "will", "were", "they"]);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w))
    .slice(0, 5)
    .sort()
    .join("|");
}

async function handleGetNcrHistory(db, userId, args) {
  const daysBack = args.days_back ?? 365;
  const limit = Math.min(Number(args.limit) || 100, 200);
  const filter = { user_id: userId, created_at: { $gte: daysAgoIso(daysBack) } };
  if (args.status_filter) filter.status = args.status_filter;

  const rows = await db.collection("ncrs").find(filter).sort({ created_at: -1 }).limit(limit).toArray();
  return { count: rows.length, window_days: daysBack, ncrs: serializeDoc(rows) };
}

async function handleGetOpenCapas(db, userId, args) {
  void args.days_back;
  const rows = await db
    .collection("capas")
    .find({
      user_id: userId,
      status: { $nin: ["closed"] },
    })
    .sort({ created_at: -1 })
    .limit(120)
    .toArray();

  return {
    count: rows.length,
    capas: serializeDoc(rows).map((c) => ({
      id: c.id,
      capa_number: c.capa_number,
      title: c.title,
      priority: c.priority,
      status: c.status,
      ncr_id: c.ncr_id,
      linked_ncr_ids: c.linked_ncr_ids || [],
      due_date: c.due_date,
      created_at: c.created_at,
    })),
  };
}

async function handleDetectPattern(db, userId, args) {
  const daysBack = args.days_back ?? 180;
  const minSize = Math.max(2, Number(args.min_cluster_size) || 2);
  const cutoff = daysAgoIso(daysBack);
  const midpoint = daysAgoIso(Math.floor(daysBack / 2)); // split window for trend detection

  const ncrs = await db.collection("ncrs").find({ user_id: userId, created_at: { $gte: cutoff } }).sort({ created_at: -1 }).limit(200).toArray();

  const [supplierDocs, partDocs] = await Promise.all([
    db.collection("suppliers").find({ user_id: userId }).toArray(),
    db.collection("parts").find({ user_id: userId }).toArray(),
  ]);
  const supplierName = new Map(supplierDocs.map((s) => [s._id.toString(), s.name]));
  const partLabel = new Map(partDocs.map((p) => [p._id.toString(), `${p.part_number || ""} ${p.name || ""}`.trim()]));

  // Build cluster maps: key → { ids, weights, recent_count, older_count }
  const bySupplier = new Map();
  const byPart = new Map();
  const byTheme = new Map();

  for (const n of ncrs) {
    const id = n._id.toString();
    const weight = severityWeight(n.severity);
    const isRecent = n.created_at >= midpoint;

    const addToCluster = (map, key) => {
      if (!map.has(key)) map.set(key, { ids: [], score: 0, recent: 0, older: 0 });
      const c = map.get(key);
      c.ids.push(id);
      c.score += weight;
      if (isRecent) c.recent++; else c.older++;
    };

    const sid = n.supplier_id?.toString?.() || n.supplier_id;
    const pid = n.part_id?.toString?.() || n.part_id;
    const theme = normalizeTitleKey(n.title);

    if (sid) addToCluster(bySupplier, sid);
    if (pid) addToCluster(byPart, pid);
    if (theme && theme !== "unknown") addToCluster(byTheme, theme);
  }

  const buildPatterns = (map, type, labelFn) =>
    [...map.entries()]
      .filter(([, c]) => c.ids.length >= minSize)
      .map(([key, c]) => ({
        type,
        key,
        label: labelFn(key),
        count: c.ids.length,
        severity_score: c.score,
        trend_flag: c.recent > c.older, // more NCRs in recent half → worsening
        ncr_ids: c.ids,
      }))
      .sort((a, b) => b.severity_score - a.severity_score);

  const patterns = [
    ...buildPatterns(bySupplier, "supplier_repeat", (k) => supplierName.get(k) || "Unknown Supplier"),
    ...buildPatterns(byPart, "part_repeat", (k) => partLabel.get(k) || "Unknown Part"),
    ...buildPatterns(byTheme, "title_theme", (k) => k.replace(/\|/g, " / ")),
  ];

  return {
    total_ncrs_analyzed: ncrs.length,
    window_days: daysBack,
    min_cluster_size: minSize,
    patterns,
    recommendation: patterns.length === 0
      ? "No recurring patterns detected."
      : `Top pattern: ${patterns[0].label} — ${patterns[0].count} NCRs, severity_score ${patterns[0].severity_score}${patterns[0].trend_flag ? ", WORSENING TREND" : ""}.`,
  };
}

async function handleCreateCapa(db, userId, args) {
  const now = new Date().toISOString();

  let ncrIds;
  try {
    ncrIds = (args.ncr_ids || []).map((id) => toObjectId(id));
  } catch {
    return { error: "One or more ncr_ids are invalid ObjectIds" };
  }

  if (ncrIds.length === 0) return { error: "ncr_ids must include at least one id" };

  const primaryNcr = await db.collection("ncrs").findOne({ _id: ncrIds[0], user_id: userId });
  if (!primaryNcr) return { error: "Primary NCR not found or does not belong to this user" };

  const idStrSet = new Set(ncrIds.map((x) => x.toString()));
  const openCapas = await db
    .collection("capas")
    .find({ user_id: userId, status: { $nin: ["closed"] } })
    .project({ capa_number: 1, ncr_id: 1, linked_ncr_ids: 1 })
    .limit(200)
    .toArray();

  const ncrIdStr = (id) => {
    if (id == null || id === "") return null;
    if (typeof id === "object" && typeof id.toString === "function") return id.toString();
    return String(id);
  };

  for (const c of openCapas) {
    const linked = new Set();
    for (const x of c.linked_ncr_ids || []) {
      const s = ncrIdStr(x);
      if (s) linked.add(s);
    }
    const primary = ncrIdStr(c.ncr_id);
    if (primary) linked.add(primary);
    for (const nid of idStrSet) {
      if (linked.has(nid)) {
        return {
          error: "Duplicate prevented: an open CAPA already references one or more of these NCRs",
          existing_capa_number: c.capa_number,
          overlapping_ncr_id: nid,
        };
      }
    }
  }

  const priority = args.priority || "medium";

  const doc = normalizeForMongo({
    user_id: userId,
    capa_number: `CAPA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    title: args.title,
    description: args.description,
    type: args.type || "corrective",
    status: "open",
    priority,
    ncr_id: ncrIds[0],
    linked_ncr_ids: ncrIds.map((x) => x.toString()),
    root_cause: args.root_cause,
    action_plan: args.action_plan,
    assigned_to: args.assigned_to || null,
    due_date: dueDateFromPriority(priority),
    trigger_reason: args.trigger_reason || "CAPA Agent — recurring NCR pattern",
    source: "capa_agent",
    verification_method: null,
    effectiveness_check: null,
    effectiveness_due_date: null,
    created_at: now,
    updated_at: now,
  });

  const result = await db.collection("capas").insertOne(doc);

  // Update all linked NCRs to reference this CAPA
  if (ncrIds.length > 0) {
    await db.collection("ncrs").updateMany(
      { _id: { $in: ncrIds }, user_id: userId },
      { $set: { capa_opened: true, updated_at: now } },
    );
  }

  const created = await db.collection("capas").findOne({ _id: result.insertedId });
  return serializeDoc(created);
}

async function handleNotifyEngineer(db, userId, args) {
  const now = new Date().toISOString();
  const ins = await db.collection("capa_agent_notifications").insertOne({
    user_id: userId,
    source: "capa_agent",
    recipient_name: args.recipient_name,
    recipient_email: args.recipient_email || null,
    message: args.message,
    urgency: args.urgency || "medium",
    capa_id: args.capa_id || null,
    ncr_numbers: args.ncr_numbers || [],
    acknowledged: false,
    created_at: now,
  });
  return { logged: true, notification_id: ins.insertedId.toString() };
}

// ---------------------------------------------------------------------------
// Gemini agentic loop
// ---------------------------------------------------------------------------

function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
  return raw;
}

async function executeTool(db, userId, name, rawArgs) {
  const args = parseArgs(rawArgs);
  switch (name) {
    case "get_ncr_history": return handleGetNcrHistory(db, userId, args);
    case "get_open_capas": return handleGetOpenCapas(db, userId, args);
    case "detect_pattern": return handleDetectPattern(db, userId, args);
    case "create_capa": return handleCreateCapa(db, userId, args);
    case "notify_engineer": return handleNotifyEngineer(db, userId, args);
    default: return { error: `Unknown tool: ${name}` };
  }
}

async function runGeminiCapaLoop(db, userId, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const daysHint = options.days_back ?? 180;

  const contents = [
    {
      role: "user",
      parts: [{ text: `Run a CAPA analysis. Analysis window: last ${daysHint} days. Follow your workflow: get_ncr_history → get_open_capas → detect_pattern → decide on create_capa and notify_engineer.` }],
    },
  ];

  const actionsLog = [];
  let finalSummary = "";

  for (let turn = 0; turn < 14; turn++) {
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
      throw new Error(`Gemini CAPA agent failed: ${response.status} ${text}`);
    }

    const json = await response.json();
    const candidate = json.candidates?.[0];
    if (!candidate) throw new Error("No candidate from Gemini");

    const parts = candidate.content?.parts || [];
    contents.push({ role: "model", parts });

    const text = parts.filter((p) => p.text).map((p) => p.text).join("\n");
    if (text) finalSummary = text;

    const calls = parts.filter((p) => p.functionCall);
    if (calls.length === 0) break;

    const toolResults = [];
    for (const part of calls) {
      const { name, args } = part.functionCall;
      const result = await executeTool(db, userId, name, args);
      actionsLog.push({ tool: name, args, result });
      toolResults.push({ functionResponse: { name, response: { content: result } } });
    }
    contents.push({ role: "user", parts: toolResults });
  }

  return { actionsLog, summary: finalSummary };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

export async function runCapaAgent(db, userId, options = {}) {
  const startedAt = Date.now();
  let result;

  try {
    result = await runGeminiCapaLoop(db, userId, options);
  } catch (err) {
    await logAgentRun(db, {
      userId,
      agentType: "capa",
      triggerEvent: options.trigger || "capa_analysis",
      inputData: { options },
      reasoning: "",
      actionTaken: "CAPA agent failed to run",
      recordsAffected: [],
      confidence: 0,
      requiresHumanReview: true,
      status: "failed",
      error: err.message,
    });
    throw err;
  }

  const { actionsLog, summary } = result;
  const capaAction = actionsLog.find((a) => a.tool === "create_capa" && a.result?.id);
  const notifyAction = actionsLog.find((a) => a.tool === "notify_engineer" && a.result?.logged);
  const patternAction = actionsLog.find((a) => a.tool === "detect_pattern");

  const recordsAffected = [
    ...(capaAction?.result?.id ? [capaAction.result.id] : []),
    ...(notifyAction?.result?.notification_id ? [notifyAction.result.notification_id] : []),
  ];

  const topPattern = patternAction?.result?.patterns?.[0];
  const requiresHumanReview = !!(capaAction || (topPattern && topPattern.severity_score >= 6));

  await logAgentRun(db, {
    userId,
    agentType: "capa",
    triggerEvent: options.trigger || "capa_analysis",
    inputData: { options },
    reasoning: summary,
    actionTaken: capaAction
      ? `Opened ${capaAction.result.capa_number} (${capaAction.result.priority} priority, due ${capaAction.result.due_date}): ${capaAction.result.title}`
      : notifyAction
        ? "Logged engineering notification — no new CAPA warranted"
        : "Analysis complete — no recurring pattern met CAPA threshold",
    recordsAffected,
    confidence: capaAction ? 0.87 : 0.95,
    requiresHumanReview,
    status: "completed",
  });

  return {
    agent: "capa",
    actions: actionsLog.map((a) => a.tool),
    capa_created: capaAction?.result || null,
    pattern_summary: patternAction?.result || null,
    notifications_logged: notifyAction ? 1 : 0,
    summary,
    duration_ms: Date.now() - startedAt,
  };
}

/**
 * Called by the NCR Change Stream when a critical/major NCR is inserted.
 * Runs a focused 30-day analysis instead of the full 180-day window.
 */
export async function runCapaAgentOnNcr(db, userId, ncrId) {
  return runCapaAgent(db, userId, {
    days_back: 90,
    min_cluster_size: 2,
    trigger: `ncr_created:${ncrId}`,
  });
}

export async function ensureCapaAgentIndexes(db) {
  await Promise.all([
    db.collection("capa_agent_notifications").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("capa_agent_notifications").createIndex({ user_id: 1, acknowledged: 1 }),
    db.collection("capas").createIndex({ user_id: 1, source: 1, status: 1 }),
    db.collection("ncrs").createIndex({ user_id: 1, capa_opened: 1 }),
  ]);
}
