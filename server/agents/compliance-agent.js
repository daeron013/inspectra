import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { serializeDoc } from "../qms.js";
import { logAgentRun } from "../agent-runs.js";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the Compliance Agent — a regulatory risk prioritizer, not a generic reminder bot.

Your unique job: decide which deadlines and obligations actually elevate regulatory risk once you see the full business context. Other agents only see their own domain (inspection, supplier, CAPA). You connect dots across suppliers, parts/device risk class, audit history, open CAPA/NCR debt, and the deadline horizon.

How to think:
- A supplier cert due date matters more if that supplier is the only source for Class II/III components used on fielded devices, or if audits are already overdue.
- A CAPA due date matters more when linked NCR severity was high or multiple open CAPAs stack up.
- Device exposure: finished devices tied to higher-risk parts amplify the same calendar item.
- Deprioritize "noise" due dates that are routine and well-covered with no compounding factors — say so explicitly.

Workflow:
1. Call get_cross_domain_snapshot — dependency, device risk bridges, audit gaps, open quality debt.
2. Call scan_compliance_horizon — raw upcoming/overdue dates across entities.
3. Synthesize a prioritized view: which items deserve executive attention and why (cross-domain rationale).
4. Call record_prioritized_risks with 3–12 items, each with priority_tier P0 (immediate) through P3 (watch), entity_type, entity_id, due_date if any, context_factors, and short reasoning.
5. If any P0 or critical compound risk, call notify_compliance_escalation.

Use only the compliance agent tools. Do not claim to update supplier/CAPA records directly — your writes go to compliance_agent_* collections only.

Finish with a concise narrative summary for leadership.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_cross_domain_snapshot",
        description:
          "Single read of suppliers (certs, audits, requal dates, parts supplied, Class II/III exposure), parts, devices with inferred max component risk via device_lots→lots→parts, open CAPAs and non-closed NCRs, and recent documents. Use to reason about compounded regulatory risk.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "scan_compliance_horizon",
        description:
          "Flattened deadline scan: supplier cert/requal/next audit, open CAPA due and effectiveness dates, lot material expiry (next horizon_days). Sorted by urgency (days_until ascending).",
        parameters: {
          type: "OBJECT",
          properties: {
            horizon_days: { type: "NUMBER", description: "How far ahead to include lot material expiry (default 365)." },
          },
        },
      },
      {
        name: "record_prioritized_risks",
        description:
          "Persist prioritized risk rows to compliance_agent_risk_items (this agent's database only). Each item should reflect cross-domain judgment, not raw chronological order.",
        parameters: {
          type: "OBJECT",
          properties: {
            items: {
              type: "ARRAY",
              description: "3–12 prioritized rows.",
              items: {
                type: "OBJECT",
                properties: {
                  title: { type: "STRING" },
                  priority_tier: { type: "STRING", enum: ["P0", "P1", "P2", "P3"] },
                  entity_type: {
                    type: "STRING",
                    enum: ["supplier", "capa", "ncr", "lot", "document", "device", "portfolio"],
                  },
                  entity_id: { type: "STRING", description: "Mongo id when applicable, or 'n/a' for portfolio-level." },
                  due_date: { type: "STRING", description: "ISO date if relevant." },
                  context_factors: {
                    type: "STRING",
                    description: "Short JSON or prose: e.g. sole_source_class_III, device_exposure_III, audit_overdue_days, open_capa_count.",
                  },
                  reasoning: { type: "STRING", description: "One or two sentences — why this ranks here vs other deadlines." },
                },
                required: ["title", "priority_tier", "entity_type", "reasoning"],
              },
            },
          },
          required: ["items"],
        },
      },
      {
        name: "notify_compliance_escalation",
        description: "Log a compliance/quality leadership notification (stored only in compliance_agent_notifications).",
        parameters: {
          type: "OBJECT",
          properties: {
            recipient_name: { type: "STRING" },
            recipient_email: { type: "STRING" },
            message: { type: "STRING" },
            urgency: { type: "STRING", enum: ["low", "medium", "high"] },
            related_entity_type: { type: "STRING" },
            related_entity_id: { type: "STRING" },
          },
          required: ["recipient_name", "message", "urgency"],
        },
      },
    ],
  },
];

function daysUntilDate(isoOrDateStr) {
  if (!isoOrDateStr) return null;
  const d = new Date(`${String(isoOrDateStr).trim()}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / 86400000);
}

function riskRank(rc) {
  const s = String(rc || "").toUpperCase();
  if (s === "III") return 3;
  if (s === "II") return 2;
  if (s === "I") return 1;
  return 0;
}

function riskLabelFromRank(n) {
  if (n >= 3) return "III";
  if (n >= 2) return "II";
  if (n >= 1) return "I";
  return "none";
}

async function handleGetCrossDomainSnapshot(db, userId) {
  const [suppliers, parts, lots, devices, capas, ncrs, documents] = await Promise.all([
    db.collection("suppliers").find({ user_id: userId }).toArray(),
    db.collection("parts").find({ user_id: userId }).toArray(),
    db.collection("lots").find({ user_id: userId }).toArray(),
    db.collection("devices").find({ user_id: userId }).toArray(),
    db.collection("capas").find({ user_id: userId }).toArray(),
    db.collection("ncrs").find({ user_id: userId }).toArray(),
    db.collection("documents").find({ user_id: userId }).project({ title: 1, document_type: 1, status: 1, version: 1, created_at: 1, updated_at: 1 }).limit(80).toArray(),
  ]);

  const deviceObjectIds = devices.map((d) => d._id).filter((id) => id instanceof ObjectId);
  const deviceLots =
    deviceObjectIds.length > 0
      ? await db.collection("device_lots").find({ device_id: { $in: deviceObjectIds } }).toArray()
      : [];

  const lotMap = new Map(lots.map((l) => [l._id.toString(), l]));
  const partMap = new Map(parts.map((p) => [p._id.toString(), p]));

  const partsBySupplier = new Map();
  for (const p of parts) {
    const sid = p.supplier_id?.toString?.() || p.supplier_id;
    if (!sid) continue;
    if (!partsBySupplier.has(sid)) partsBySupplier.set(sid, { total: 0, class_ii: 0, class_iii: 0 });
    const row = partsBySupplier.get(sid);
    row.total += 1;
    const r = String(p.risk_class || "").toUpperCase();
    if (r === "II") row.class_ii += 1;
    if (r === "III") row.class_iii += 1;
  }

  const supplierSummaries = suppliers.map((s) => {
    const sid = s._id.toString();
    const pc = partsBySupplier.get(sid) || { total: 0, class_ii: 0, class_iii: 0 };
    const certDays = daysUntilDate(s.certification_expiry);
    const requalDays = daysUntilDate(s.requalification_due_date);
    const nextAuditDays = daysUntilDate(s.next_audit_date);
    const daysSinceLastAudit = s.last_audit_date ? -daysUntilDate(s.last_audit_date) : null;

    return {
      supplier_id: sid,
      name: s.name,
      code: s.code,
      status: s.status,
      risk_level: s.risk_level,
      certification_expiry: s.certification_expiry,
      days_until_cert_expiry: certDays,
      requalification_due_date: s.requalification_due_date,
      days_until_requal: requalDays,
      next_audit_date: s.next_audit_date,
      days_until_next_audit: nextAuditDays,
      last_audit_date: s.last_audit_date,
      days_since_last_audit: daysSinceLastAudit,
      parts_supplied_count: pc.total,
      class_ii_parts: pc.class_ii,
      class_iii_parts: pc.class_iii,
      model_note:
        "Each part links to one supplier in this QMS — Class II/III part counts indicate higher regulatory impact if that supplier slips.",
    };
  });

  const deviceExposure = devices.map((dev) => {
    let maxR = 0;
    const supplierIds = new Set();
    for (const dl of deviceLots) {
      if (dl.device_id?.toString?.() !== dev._id.toString()) continue;
      const lot = lotMap.get(dl.lot_id?.toString?.() || "");
      if (!lot) continue;
      const part = partMap.get(lot.part_id?.toString?.() || "");
      if (part) {
        maxR = Math.max(maxR, riskRank(part.risk_class));
        const sid = part.supplier_id?.toString?.() || part.supplier_id;
        if (sid) supplierIds.add(sid);
      }
    }
    return {
      device_id: dev._id.toString(),
      name: dev.name,
      serial_number: dev.serial_number,
      max_component_risk_class: riskLabelFromRank(maxR),
      linked_supplier_ids_sample: [...supplierIds].slice(0, 8),
    };
  });

  const openCapas = capas.filter((c) => String(c.status || "").toLowerCase() !== "closed");
  const openNcrs = ncrs.filter((n) => String(n.status || "").toLowerCase() !== "closed");
  const criticalOpenNcrs = openNcrs.filter((n) => ["critical", "major"].includes(String(n.severity || "").toLowerCase()));

  return {
    supplier_count: suppliers.length,
    part_count: parts.length,
    device_count: devices.length,
    open_capa_count: openCapas.length,
    open_ncr_count: openNcrs.length,
    critical_open_ncr_count: criticalOpenNcrs.length,
    suppliers: supplierSummaries,
    device_regulatory_exposure: deviceExposure,
    open_capas_summary: openCapas.slice(0, 25).map((c) => ({
      id: c._id.toString(),
      capa_number: c.capa_number,
      title: c.title,
      status: c.status,
      priority: c.priority,
      due_date: c.due_date,
      days_until_due: daysUntilDate(c.due_date),
    })),
    critical_open_ncrs: criticalOpenNcrs.slice(0, 15).map((n) => ({
      id: n._id.toString(),
      ncr_number: n.ncr_number,
      title: n.title,
      severity: n.severity,
      supplier_id: n.supplier_id?.toString?.() || n.supplier_id,
    })),
    documents_trim: serializeDoc(documents).slice(0, 40),
  };
}

async function handleScanComplianceHorizon(db, userId, args) {
  const horizonDays = Math.min(Math.max(Number(args.horizon_days) || 365, 30), 730);

  const [suppliers, capas, lots] = await Promise.all([
    db.collection("suppliers").find({ user_id: userId }).toArray(),
    db.collection("capas").find({ user_id: userId }).toArray(),
    db.collection("lots").find({ user_id: userId }).toArray(),
  ]);

  const rows = [];

  const pushRow = (type, entityId, label, due, extra = {}) => {
    const days = daysUntilDate(due);
    if (due == null || days === null) return;
    rows.push({
      type,
      entity_type_hint: type.split("_")[0] || type,
      entity_id: entityId,
      label,
      due_date: typeof due === "string" ? due.split("T")[0] : due,
      days_until: days,
      ...extra,
    });
  };

  for (const s of suppliers) {
    const sid = s._id.toString();
    pushRow("supplier_cert_expiry", sid, `${s.name} — certification`, s.certification_expiry);
    pushRow("supplier_requalification", sid, `${s.name} — requalification`, s.requalification_due_date);
    pushRow("supplier_next_audit", sid, `${s.name} — next audit`, s.next_audit_date);
  }

  for (const c of capas) {
    if (String(c.status || "").toLowerCase() === "closed") continue;
    const cid = c._id.toString();
    pushRow("capa_due", cid, `${c.capa_number} — CAPA due`, c.due_date, { capa_number: c.capa_number });
    if (c.effectiveness_due_date) {
      pushRow("capa_effectiveness", cid, `${c.capa_number} — effectiveness review`, c.effectiveness_due_date, {
        capa_number: c.capa_number,
      });
    }
  }

  for (const l of lots) {
    if (!l.expiration_date) continue;
    const days = daysUntilDate(l.expiration_date);
    if (days === null) continue;
    if (days > horizonDays) continue;
    rows.push({
      type: "lot_material_expiry",
      entity_type_hint: "lot",
      entity_id: l._id.toString(),
      label: `Lot ${l.lot_number} — material expiry`,
      due_date: String(l.expiration_date).split("T")[0],
      days_until: days,
      lot_number: l.lot_number,
    });
  }

  rows.sort((a, b) => a.days_until - b.days_until);

  return {
    horizon_days: horizonDays,
    deadline_count: rows.length,
    deadlines: rows.slice(0, 120),
    overdue_count: rows.filter((r) => r.days_until < 0).length,
    due_30d_count: rows.filter((r) => r.days_until >= 0 && r.days_until <= 30).length,
  };
}

async function handleRecordPrioritizedRisks(db, userId, args) {
  const items = Array.isArray(args.items) ? args.items : [];
  if (items.length === 0) return { error: "items array required" };
  if (items.length > 20) return { error: "At most 20 items per call" };

  const now = new Date().toISOString();
  const runBatchId = crypto.randomUUID();
  const docs = items.map((it) => ({
    user_id: userId,
    run_batch_id: runBatchId,
    source: "compliance_agent",
    title: String(it.title || "").slice(0, 300),
    priority_tier: String(it.priority_tier || "P3").toUpperCase(),
    entity_type: String(it.entity_type || "portfolio"),
    entity_id: it.entity_id ? String(it.entity_id).slice(0, 64) : null,
    due_date: it.due_date ? String(it.due_date).slice(0, 32) : null,
    context_factors: typeof it.context_factors === "string" ? it.context_factors.slice(0, 1200) : JSON.stringify(it.context_factors || {}),
    reasoning: String(it.reasoning || "").slice(0, 1500),
    acknowledged: false,
    created_at: now,
  }));

  const result = await db.collection("compliance_agent_risk_items").insertMany(docs);
  return {
    recorded: result.insertedCount,
    run_batch_id: runBatchId,
    ids: Object.values(result.insertedIds || {}).map((id) => id.toString()),
  };
}

async function handleNotifyComplianceEscalation(db, userId, args) {
  const now = new Date().toISOString();
  const ins = await db.collection("compliance_agent_notifications").insertOne({
    user_id: userId,
    source: "compliance_agent",
    recipient_name: args.recipient_name,
    recipient_email: args.recipient_email || null,
    message: args.message,
    urgency: args.urgency || "medium",
    related_entity_type: args.related_entity_type || null,
    related_entity_id: args.related_entity_id || null,
    acknowledged: false,
    created_at: now,
  });
  return { logged: true, notification_id: ins.insertedId.toString() };
}

function parseArgs(raw) {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

async function executeTool(db, userId, name, rawArgs) {
  const args = parseArgs(rawArgs);
  switch (name) {
    case "get_cross_domain_snapshot":
      return handleGetCrossDomainSnapshot(db, userId);
    case "scan_compliance_horizon":
      return handleScanComplianceHorizon(db, userId, args);
    case "record_prioritized_risks":
      return handleRecordPrioritizedRisks(db, userId, args);
    case "notify_compliance_escalation":
      return handleNotifyComplianceEscalation(db, userId, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function runGeminiComplianceLoop(db, userId, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const horizon = options.horizon_days ?? 365;

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `Run a regulatory risk prioritization pass. Horizon for lot material dates: ${horizon} days. Follow workflow: get_cross_domain_snapshot → scan_compliance_horizon (horizon_days=${horizon}) → record_prioritized_risks → notify_compliance_escalation if warranted.`,
        },
      ],
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
      throw new Error(`Gemini compliance agent failed: ${response.status} ${text}`);
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

export async function runComplianceAgent(db, userId, options = {}) {
  const startedAt = Date.now();
  let result;

  try {
    result = await runGeminiComplianceLoop(db, userId, options);
  } catch (err) {
    await logAgentRun(db, {
      userId,
      agentType: "compliance",
      triggerEvent: options.trigger || "compliance_prioritization",
      inputData: { options },
      reasoning: "",
      actionTaken: "Compliance agent failed to run",
      recordsAffected: [],
      confidence: 0,
      requiresHumanReview: true,
      status: "failed",
      error: err.message,
    });
    throw err;
  }

  const { actionsLog, summary } = result;
  const recorded = actionsLog.find((a) => a.tool === "record_prioritized_risks" && a.result?.run_batch_id);
  const notifies = actionsLog.filter((a) => a.tool === "notify_compliance_escalation" && a.result?.logged);

  const recordsAffected = [
    ...(recorded?.result?.ids || []),
    ...notifies.map((n) => n.result.notification_id),
  ];

  const recAction = actionsLog.find((a) => a.tool === "record_prioritized_risks");
  const recItems = Array.isArray(recAction?.args?.items) ? recAction.args.items : [];
  const p0Count = recItems.filter((i) => String(i.priority_tier || "").toUpperCase() === "P0").length;

  const requiresHumanReview = !!(notifies.length > 0 || p0Count > 0);

  const actionTaken = recorded?.result?.recorded
    ? `Recorded ${recorded.result.recorded} prioritized risk row(s)${notifies.length ? `; ${notifies.length} escalation(s) logged` : ""}.`
    : "Analysis complete — no prioritized risks recorded (review tool trace).";

  await logAgentRun(db, {
    userId,
    agentType: "compliance",
    triggerEvent: options.trigger || "compliance_prioritization",
    inputData: { options },
    reasoning: summary,
    actionTaken,
    recordsAffected,
    confidence: 0.88,
    requiresHumanReview,
    status: "completed",
  });

  return {
    agent: "compliance",
    actions: actionsLog.map((a) => a.tool),
    run_batch_id: recorded?.result?.run_batch_id || null,
    risk_items_recorded: recorded?.result?.recorded ?? 0,
    escalations_logged: notifies.length,
    summary,
    duration_ms: Date.now() - startedAt,
  };
}

export async function listComplianceAgentRiskItems(db, userId, { limit = 50 } = {}) {
  const cap = Math.min(Math.max(limit, 1), 150);
  const rows = await db
    .collection("compliance_agent_risk_items")
    .find({ user_id: userId })
    .sort({ created_at: -1 })
    .limit(cap)
    .toArray();
  return serializeDoc(rows);
}

export async function ensureComplianceAgentIndexes(db) {
  await Promise.all([
    db.collection("compliance_agent_risk_items").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("compliance_agent_risk_items").createIndex({ user_id: 1, run_batch_id: 1 }),
    db.collection("compliance_agent_risk_items").createIndex({ user_id: 1, priority_tier: 1 }),
    db.collection("compliance_agent_notifications").createIndex({ user_id: 1, created_at: -1 }),
  ]);
}
