import { toObjectId } from "../db.js";
import { normalizeForMongo, serializeDoc } from "../qms.js";
import { logAgentRun } from "../agent-runs.js";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";

const SYSTEM_PROMPT = `You are the Supplier Agent for an ISO 13485–aware supplier qualification program.

Domain: supplier risk posture, certification expiry, NCR/defect signals, failed incoming inspections, and procurement notifications.
You do NOT create CAPAs, edit NCRs, or run lot inspections.

Workflow:
1. Call get_supplier_metrics first. If the user scoped a single supplier, pass supplier_id; otherwise analyze the full portfolio.
2. Each row includes composite_risk_score (0–100, higher = worse), cert_status, ncr_trend, and score_breakdown. Use these — not guesswork.
3. For suppliers that need a record update, call update_supplier_risk_profile (risk_level and/or status and a short agent_summary). Map score to risk_level when adjusting: 0–24 low, 25–49 medium, 50–74 high, 75+ critical.
4. When procurement should act (expired cert, disqualified path, sustained worsening trend), call notify_procurement.

Keep agent_summary factual and under 400 characters. After tools, give a concise summary for the quality manager.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_supplier_metrics",
        description:
          "Portfolio or single-supplier metrics: certification expiry bucket, open NCR count, severity-weighted NCR activity in the last 90 days vs prior 90 days (trend), failed inspections in last 90 days linked via lots, recorded defect_rate, and composite_risk_score with breakdown.",
        parameters: {
          type: "OBJECT",
          properties: {
            supplier_id: { type: "STRING", description: "Optional Mongo ObjectId — if set, only this supplier." },
            days_back: { type: "NUMBER", description: "NCR analysis window in days (default 365, max 730)." },
          },
        },
      },
      {
        name: "update_supplier_risk_profile",
        description:
          "Persist risk_level, qualification status, and/or a short agent-written summary on the supplier record. Use after metrics show a sustained or critical issue.",
        parameters: {
          type: "OBJECT",
          properties: {
            supplier_id: { type: "STRING", description: "Mongo ObjectId of the supplier." },
            risk_level: { type: "STRING", enum: ["low", "medium", "high", "critical"] },
            status: { type: "STRING", enum: ["approved", "conditional", "pending", "disqualified"] },
            agent_summary: { type: "STRING", description: "Concise assessment for the supplier record (max ~400 chars)." },
          },
          required: ["supplier_id"],
        },
      },
      {
        name: "notify_procurement",
        description: "Log a procurement / supply-chain notification for follow-up (audit trail).",
        parameters: {
          type: "OBJECT",
          properties: {
            recipient_name: { type: "STRING" },
            recipient_email: { type: "STRING" },
            message: { type: "STRING" },
            urgency: { type: "STRING", enum: ["low", "medium", "high"] },
            supplier_id: { type: "STRING", description: "Related supplier id if applicable." },
          },
          required: ["recipient_name", "message", "urgency"],
        },
      },
    ],
  },
];

function daysAgoIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function severityWeight(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "critical") return 4;
  if (s === "major") return 3;
  if (s === "minor") return 2;
  return 1;
}

function certBucket(expiryStr) {
  if (!expiryStr) return { cert_status: "unknown", days_until_cert_expiry: null };
  const exp = new Date(`${String(expiryStr).trim()}T12:00:00Z`);
  if (Number.isNaN(exp.getTime())) return { cert_status: "unknown", days_until_cert_expiry: null };
  const days = Math.floor((exp.getTime() - Date.now()) / 86400000);
  if (days < 0) return { cert_status: "expired", days_until_cert_expiry: days };
  if (days <= 30) return { cert_status: "expiring_30", days_until_cert_expiry: days };
  if (days <= 90) return { cert_status: "expiring_90", days_until_cert_expiry: days };
  return { cert_status: "ok", days_until_cert_expiry: days };
}

function riskLevelBase(level) {
  const s = String(level || "").toLowerCase();
  if (s === "critical") return 40;
  if (s === "high") return 30;
  if (s === "medium") return 20;
  if (s === "low") return 10;
  return 8;
}

function computeCompositeScore(supplierDoc, ncrStats, cert, failedInspections90) {
  let score = riskLevelBase(supplierDoc.risk_level);
  const breakdown = {
    from_recorded_risk: score,
    cert: 0,
    ncr_activity: 0,
    trend: 0,
    defect_rate: 0,
    inspection_failures: 0,
  };

  if (cert.cert_status === "expired") {
    breakdown.cert = 28;
    score += 28;
  } else if (cert.cert_status === "expiring_30") {
    breakdown.cert = 15;
    score += 15;
  } else if (cert.cert_status === "expiring_90") {
    breakdown.cert = 8;
    score += 8;
  }

  const wsum = ncrStats.weighted_90d || 0;
  const ncrContribution = Math.min(26, Math.round(wsum * 2.5));
  breakdown.ncr_activity = ncrContribution;
  score += ncrContribution;

  if (ncrStats.trend === "worsening") {
    breakdown.trend = 10;
    score += 10;
  } else if (ncrStats.trend === "slightly_worsening") {
    breakdown.trend = 5;
    score += 5;
  }

  const dr = Number(supplierDoc.defect_rate);
  if (!Number.isNaN(dr) && dr > 0) {
    if (dr > 5) {
      breakdown.defect_rate = 15;
      score += 15;
    } else if (dr > 2) {
      breakdown.defect_rate = 8;
      score += 8;
    }
  }

  const fi = failedInspections90 || 0;
  const fiScore = Math.min(12, fi * 4);
  breakdown.inspection_failures = fiScore;
  score += fiScore;

  if (String(supplierDoc.status || "").toLowerCase() === "disqualified") {
    score = Math.max(score, 85);
  }

  score = Math.min(100, Math.round(score));
  return { score, breakdown };
}

async function handleGetSupplierMetrics(db, userId, args) {
  const daysBack = Math.min(Math.max(Number(args.days_back) || 365, 30), 730);
  const cutoff = daysAgoIso(daysBack);
  const mid90 = daysAgoIso(90);
  const mid180 = daysAgoIso(180);

  const supplierFilter = { user_id: userId };
  if (args.supplier_id) {
    try {
      supplierFilter._id = toObjectId(args.supplier_id);
    } catch {
      return { error: "Invalid supplier_id" };
    }
  }

  const [suppliers, ncrs, openNcrs, lots, inspections] = await Promise.all([
    db.collection("suppliers").find(supplierFilter).toArray(),
    db.collection("ncrs").find({ user_id: userId, created_at: { $gte: cutoff } }).toArray(),
    db.collection("ncrs").find({ user_id: userId, status: { $ne: "closed" } }).project({ supplier_id: 1 }).toArray(),
    db.collection("lots").find({ user_id: userId }).toArray(),
    db.collection("inspections").find({ user_id: userId, status: "failed", created_at: { $gte: mid90 } }).toArray(),
  ]);

  const openCountBySupplier = new Map();
  for (const n of openNcrs) {
    const sid = n.supplier_id?.toString?.() || n.supplier_id;
    if (!sid) continue;
    openCountBySupplier.set(sid, (openCountBySupplier.get(sid) || 0) + 1);
  }

  const lotIdToSupplier = new Map();
  for (const l of lots) {
    const sid = l.supplier_id?.toString?.() || l.supplier_id;
    if (sid) lotIdToSupplier.set(l._id.toString(), sid);
  }

  const failedBySupplier = new Map();
  for (const ins of inspections) {
    const lid = ins.lot_id?.toString?.() || ins.lot_id;
    if (!lid) continue;
    const sid = lotIdToSupplier.get(lid);
    if (!sid) continue;
    failedBySupplier.set(sid, (failedBySupplier.get(sid) || 0) + 1);
  }

  const bySupplier = new Map();
  for (const n of ncrs) {
    const sid = n.supplier_id?.toString?.() || n.supplier_id;
    if (!sid) continue;
    if (!bySupplier.has(sid)) {
      bySupplier.set(sid, { last90: [], prior90: [] });
    }
    const b = bySupplier.get(sid);
    const w = severityWeight(n.severity);
    if (n.created_at >= mid90) b.last90.push(w);
    else if (n.created_at >= mid180) b.prior90.push(w);
  }

  const sumW = (arr) => arr.reduce((a, x) => a + x, 0);

  const metrics = suppliers.map((s) => {
    const sid = s._id.toString();
    const cert = certBucket(s.certification_expiry);
    const b = bySupplier.get(sid) || { last90: [], prior90: [] };
    const w90 = sumW(b.last90);
    const wPrior = sumW(b.prior90);
    const cnt90 = b.last90.length;
    const cntPrior = b.prior90.length;

    let trend = "stable";
    if (cnt90 > cntPrior + 1 || w90 > wPrior + 3) trend = "worsening";
    else if (cnt90 > cntPrior) trend = "slightly_worsening";
    else if (cnt90 < cntPrior && cntPrior >= 2) trend = "improving";

    const ncrStats = { weighted_90d: w90, trend };
    const fi90 = failedBySupplier.get(sid) || 0;
    const { score, breakdown } = computeCompositeScore(s, ncrStats, cert, fi90);

    const windowCount = ncrs.filter((n) => (n.supplier_id?.toString?.() || n.supplier_id) === sid).length;

    return {
      supplier_id: sid,
      name: s.name,
      code: s.code,
      status: s.status,
      risk_level: s.risk_level,
      defect_rate_recorded: s.defect_rate,
      on_time_delivery: s.on_time_delivery,
      certification_type: s.certification_type,
      ...cert,
      failed_inspections_90d: fi90,
      ncr_count_window: windowCount,
      open_ncr_count: openCountBySupplier.get(sid) || 0,
      weighted_severity_90d: w90,
      ncr_trend: trend,
      composite_risk_score: score,
      score_breakdown: breakdown,
    };
  });

  metrics.sort((a, b) => b.composite_risk_score - a.composite_risk_score);

  const portfolioAlerts = metrics.filter(
    (m) =>
      m.cert_status === "expired" ||
      m.cert_status === "expiring_30" ||
      m.composite_risk_score >= 55 ||
      m.ncr_trend === "worsening",
  );

  return {
    window_days: daysBack,
    supplier_count: metrics.length,
    portfolio_alert_count: portfolioAlerts.length,
    portfolio_alert_supplier_ids: portfolioAlerts.map((m) => m.supplier_id),
    suppliers: metrics,
  };
}

async function handleUpdateSupplierRiskProfile(db, userId, args) {
  let sid;
  try {
    sid = toObjectId(args.supplier_id);
  } catch {
    return { error: "Invalid supplier_id" };
  }

  const existing = await db.collection("suppliers").findOne({ _id: sid, user_id: userId });
  if (!existing) return { error: "Supplier not found" };

  const now = new Date().toISOString();
  const set = { updated_at: now, last_supplier_agent_run_at: now };

  const allowedRisk = new Set(["low", "medium", "high", "critical"]);
  if (args.risk_level && allowedRisk.has(String(args.risk_level).toLowerCase())) {
    set.risk_level = String(args.risk_level).toLowerCase();
  }

  const allowedStatus = new Set(["approved", "conditional", "pending", "disqualified"]);
  if (args.status && allowedStatus.has(String(args.status).toLowerCase())) {
    set.status = String(args.status).toLowerCase();
  }

  if (typeof args.agent_summary === "string" && args.agent_summary.trim()) {
    set.supplier_agent_summary = args.agent_summary.trim().slice(0, 500);
  }

  await db.collection("suppliers").updateOne({ _id: sid, user_id: userId }, { $set: normalizeForMongo(set) });
  const updated = await db.collection("suppliers").findOne({ _id: sid });
  return serializeDoc(updated);
}

async function handleNotifyProcurement(db, userId, args) {
  const now = new Date().toISOString();
  const ins = await db.collection("supplier_agent_notifications").insertOne({
    user_id: userId,
    source: "supplier_agent",
    recipient_name: args.recipient_name,
    recipient_email: args.recipient_email || null,
    message: args.message,
    urgency: args.urgency || "medium",
    supplier_id: args.supplier_id || null,
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
    case "get_supplier_metrics":
      return handleGetSupplierMetrics(db, userId, args);
    case "update_supplier_risk_profile":
      return handleUpdateSupplierRiskProfile(db, userId, args);
    case "notify_procurement":
      return handleNotifyProcurement(db, userId, args);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function runGeminiSupplierLoop(db, userId, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `${GEMINI_API}/${model}:generateContent?key=${apiKey}`;
  const daysHint = options.days_back ?? 365;
  const scope = options.supplier_id
    ? `Single supplier id: ${options.supplier_id}. Pass this supplier_id to get_supplier_metrics.`
    : "Full supplier portfolio (omit supplier_id on get_supplier_metrics).";

  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `Run a supplier risk review. ${scope} Call get_supplier_metrics with days_back=${daysHint} (and supplier_id if scoped above). Workflow: get_supplier_metrics → update_supplier_risk_profile where justified → notify_procurement if escalation is needed.`,
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
      throw new Error(`Gemini supplier agent failed: ${response.status} ${text}`);
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

export async function runSupplierAgent(db, userId, options = {}) {
  const startedAt = Date.now();
  let result;

  try {
    result = await runGeminiSupplierLoop(db, userId, options);
  } catch (err) {
    await logAgentRun(db, {
      userId,
      agentType: "supplier",
      triggerEvent: options.trigger || "supplier_analysis",
      inputData: { options },
      reasoning: "",
      actionTaken: "Supplier agent failed to run",
      recordsAffected: [],
      confidence: 0,
      requiresHumanReview: true,
      status: "failed",
      error: err.message,
    });
    throw err;
  }

  const { actionsLog, summary } = result;
  const metricsAction = actionsLog.find((a) => a.tool === "get_supplier_metrics");
  const updates = actionsLog.filter(
    (a) => a.tool === "update_supplier_risk_profile" && a.result?.id && !a.result?.error,
  );
  const notifies = actionsLog.filter((a) => a.tool === "notify_procurement" && a.result?.logged);

  const recordsAffected = [
    ...updates.map((a) => a.result.id),
    ...notifies.map((a) => a.result.notification_id),
  ];

  const top = metricsAction?.result?.suppliers?.[0];
  const requiresHumanReview = !!(
    top &&
    (top.composite_risk_score >= 60 ||
      top.cert_status === "expired" ||
      notifies.length > 0 ||
      updates.some((u) => ["high", "critical"].includes(String(u.args?.risk_level || "").toLowerCase())))
  );

  const actionTaken = updates.length
    ? `Updated ${updates.length} supplier profile(s); ${notifies.length} procurement notice(s).`
    : notifies.length
      ? `Logged ${notifies.length} procurement notification(s).`
      : metricsAction?.result?.portfolio_alert_count
        ? `Flagged ${metricsAction.result.portfolio_alert_count} supplier(s) in portfolio review.`
        : "Portfolio review complete — no critical alerts in metrics.";

  await logAgentRun(db, {
    userId,
    agentType: "supplier",
    triggerEvent: options.trigger || "supplier_analysis",
    inputData: { options },
    reasoning: summary,
    actionTaken,
    recordsAffected,
    confidence: updates.length || notifies.length ? 0.82 : 0.93,
    requiresHumanReview,
    status: "completed",
  });

  return {
    agent: "supplier",
    actions: actionsLog.map((a) => a.tool),
    metrics_snapshot: metricsAction?.result || null,
    suppliers_updated: updates.map((a) => a.result),
    procurement_notices: notifies.length,
    summary,
    duration_ms: Date.now() - startedAt,
  };
}

export async function ensureSupplierAgentIndexes(db) {
  await Promise.all([
    db.collection("supplier_agent_notifications").createIndex({ user_id: 1, created_at: -1 }),
    db.collection("suppliers").createIndex({ user_id: 1, last_supplier_agent_run_at: -1 }),
  ]);
}
