import { getDb, toObjectId } from "./db.js";
import { serializeDoc } from "./qms.js";

/**
 * agent_runs collection schema:
 * {
 *   _id:                   ObjectId
 *   user_id:               string        — scopes run to a user
 *   agent_type:            string        — "inspection" | "supplier" | "capa" | "compliance"
 *   trigger_event:         string        — what caused this run (e.g. "new_inspection", "defect_threshold_exceeded")
 *   input_data:            object        — the record(s) that triggered the agent
 *   reasoning:             string        — LLM chain-of-thought / explanation
 *   action_taken:          string        — human-readable summary of what the agent did
 *   records_affected:      string[]      — IDs of any records created or updated
 *   confidence:            number        — 0.0–1.0 confidence score
 *   requires_human_review: boolean       — true if agent flagged for human approval
 *   status:                string        — "completed" | "pending_review" | "failed"
 *   error:                 string|null   — error message if status === "failed"
 *   created_at:            string        — ISO timestamp
 * }
 */

export async function logAgentRun(db, {
  userId,
  agentType,
  triggerEvent,
  inputData = {},
  reasoning = "",
  actionTaken = "",
  recordsAffected = [],
  confidence = 1.0,
  requiresHumanReview = false,
  status = "completed",
  error = null,
}) {
  const now = new Date().toISOString();

  const doc = {
    user_id: userId,
    agent_type: agentType,
    trigger_event: triggerEvent,
    input_data: inputData,
    reasoning,
    action_taken: actionTaken,
    records_affected: recordsAffected,
    confidence,
    requires_human_review: requiresHumanReview,
    status,
    error,
    created_at: now,
  };

  const result = await db.collection("agent_runs").insertOne(doc);
  const saved = await db.collection("agent_runs").findOne({ _id: result.insertedId });
  return serializeDoc(saved);
}

export async function listAgentRuns(db, userId, { agentType, status, requiresHumanReview, limit = 50 } = {}) {
  const filter = { user_id: userId };

  if (agentType) filter.agent_type = agentType;
  if (status) filter.status = status;
  if (requiresHumanReview !== undefined) filter.requires_human_review = requiresHumanReview;

  const docs = await db
    .collection("agent_runs")
    .find(filter)
    .sort({ created_at: -1 })
    .limit(limit)
    .toArray();

  return serializeDoc(docs);
}

export async function getAgentRun(db, userId, id) {
  const doc = await db.collection("agent_runs").findOne({
    _id: toObjectId(id),
    user_id: userId,
  });
  return doc ? serializeDoc(doc) : null;
}

export async function resolveAgentRun(db, userId, id) {
  await db.collection("agent_runs").updateOne(
    { _id: toObjectId(id), user_id: userId },
    { $set: { requires_human_review: false, status: "completed" } },
  );
  return getAgentRun(db, userId, id);
}

export async function ensureAgentRunsIndexes(db) {
  const col = db.collection("agent_runs");
  await Promise.all([
    col.createIndex({ user_id: 1, created_at: -1 }),
    col.createIndex({ user_id: 1, agent_type: 1, created_at: -1 }),
    col.createIndex({ user_id: 1, requires_human_review: 1 }),
    col.createIndex({ user_id: 1, status: 1 }),
  ]);
}
