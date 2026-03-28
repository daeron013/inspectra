import dotenv from "dotenv";
import crypto from "node:crypto";
import { Readable } from "node:stream";

import cors from "cors";
import express from "express";
import multer from "multer";

import { generateAssistantResponse, streamAssistantText } from "./assistant.js";
import { writeAuditLog } from "./audit.js";
import { getRequestUser, requireAuth } from "./auth.js";
import { getBucket, getDb, toObjectId } from "./db.js";
import { detectTypeFromName, processDocument } from "./rag.js";
import {
  createEntity,
  deleteEntity,
  listDocuments,
  listEntity,
  normalizeForMongo,
  serializeDoc,
  updateEntity,
} from "./qms.js";
import {
  ensureAgentRunsIndexes,
  getAgentRun,
  listAgentRuns,
  logAgentRun,
  resolveAgentRun,
} from "./agent-runs.js";
import { runInspectionAgent } from "./agents/inspection-agent.js";
<<<<<<< HEAD
import { ensureCapaAgentIndexes, runCapaAgent, runCapaAgentOnNcr } from "./agents/capa-agent.js";
import { ensureSupplierAgentIndexes, runSupplierAgent } from "./agents/supplier-agent.js";
import {
  ensureComplianceAgentIndexes,
  listComplianceAgentRiskItems,
  runComplianceAgent,
} from "./agents/compliance-agent.js";
=======
import { writeVersionSnapshot } from "./versioning.js";
>>>>>>> d31e8744 (fixed auth0)

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const parsedPort = Number.parseInt(process.env.PORT || "", 10);
const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort < 65536 ? parsedPort : 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

async function uploadBufferToGridFs(bucket, buffer, filename, metadata) {
  const stream = bucket.openUploadStream(filename, { metadata });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(stream).on("finish", resolve).on("error", reject);
  });
  return stream.id;
}

async function writeFailureAuditLog(req, action, entityType, entityId, error, metadata = {}) {
  if (!req.auth?.userId) return;

  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    await writeAuditLog(db, {
      actor,
      action,
      entityType,
      entityId,
      status: "failed",
      metadata: {
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      },
      req,
    });
  } catch (auditError) {
    console.error("write failure audit log failed", auditError);
  }
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/audit-logs", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const query = {
      actor_user_id: actor.id,
      ...(typeof req.query.entityType === "string" ? { entity_type: req.query.entityType } : {}),
      ...(typeof req.query.entityId === "string" ? { entity_id: req.query.entityId } : {}),
    };

    const logs = await db.collection("audit_logs").find(query).sort({ created_at: -1 }).limit(100).toArray();
    res.json(logs.map((entry) => serializeDoc(entry)));
  } catch (error) {
    console.error("list audit logs failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list audit logs" });
  }
});

app.get("/api/version-snapshots", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const query = {
      owner_user_id: actor.id,
      ...(typeof req.query.entityType === "string" ? { entity_type: req.query.entityType } : {}),
      ...(typeof req.query.entityId === "string" ? { entity_id: req.query.entityId } : {}),
    };

    const snapshots = await db.collection("version_snapshots").find(query).sort({ created_at: -1 }).limit(50).toArray();
    res.json(snapshots.map((entry) => serializeDoc(entry)));
  } catch (error) {
    console.error("list version snapshots failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list version snapshots" });
  }
});

app.post("/api/assistant", requireAuth, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const db = await getDb();
    const actor = getRequestUser(req);
    const text = await generateAssistantResponse(db, actor.id, messages);
    streamAssistantText(text, res);
  } catch (error) {
    console.error("assistant failed", error);
    await writeFailureAuditLog(req, "assistant.failed", "assistant", null, error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Assistant failed" });
    } else {
      res.end();
    }
  }
});

app.get("/api/documents", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const documents = await listDocuments(db, actor.id);
    res.json(documents);
  } catch (error) {
    console.error("list documents failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list documents" });
  }
});

app.post("/api/documents/upload", requireAuth, upload.array("files"), async (req, res) => {
  if (!req.files?.length) {
    res.status(400).json({ error: "At least one file is required" });
    return;
  }

  try {
    const db = await getDb();
    const bucket = await getBucket();
    const documents = db.collection("documents");
    const now = new Date().toISOString();
    const actor = getRequestUser(req);
    const created = [];

    for (const file of req.files) {
      const storageName = `${actor.id}/${Date.now()}_${file.originalname}`;
      const gridfsFileId = await uploadBufferToGridFs(bucket, file.buffer, storageName, {
        user_id: actor.id,
        original_name: file.originalname,
        mime_type: file.mimetype,
      });

      const doc = normalizeForMongo({
        user_id: actor.id,
        title: file.originalname.replace(/\.[^/.]+$/, ""),
        document_type: detectTypeFromName(file.originalname),
        version: "1.0",
        status: "draft",
        file_name: file.originalname,
        file_size: file.size,
        mime_type: file.mimetype,
        file_path: storageName,
        gridfs_file_id: gridfsFileId,
        notes: null,
        created_at: now,
        updated_at: now,
      });

      const result = await documents.insertOne(doc);
      const saved = await documents.findOne({ _id: result.insertedId });
      const serialized = serializeDoc(saved);
      created.push(serialized);

      await writeVersionSnapshot(db, {
        ownerUserId: actor.id,
        actor,
        entityType: "document",
        entityId: serialized.id,
        eventType: "created",
        after: serialized,
        metadata: {
          source: "upload",
          file_name: file.originalname,
        },
      });

      await writeAuditLog(db, {
        actor,
        action: "document.uploaded",
        entityType: "document",
        entityId: serialized.id,
        metadata: {
          file_name: file.originalname,
          mime_type: file.mimetype,
          size: file.size,
          document_type: serialized.document_type,
        },
        req,
      });
    }

    res.status(201).json(created);
  } catch (error) {
    console.error("upload failed", error);
    await writeFailureAuditLog(req, "document.uploaded", "document", null, error, {
      files: Array.isArray(req.files) ? req.files.map((file) => file.originalname) : [],
    });
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

app.post("/api/documents/:id/process", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const bucket = await getBucket();
    const actor = getRequestUser(req);
    const document = await db.collection("documents").findOne({
      _id: toObjectId(req.params.id),
      user_id: actor.id,
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const before = serializeDoc(document);
    const result = await processDocument(db, bucket, document);
    const updatedDocument = await db.collection("documents").findOne({
      _id: document._id,
      user_id: actor.id,
    });
    const after = updatedDocument ? serializeDoc(updatedDocument) : before;

    await writeVersionSnapshot(db, {
      ownerUserId: actor.id,
      actor,
      entityType: "document",
      entityId: document._id.toString(),
      eventType: "processed",
      before,
      after,
      metadata: {
        document_type: result.document_type,
        created_records: result.created_records || {},
      },
    });

    await writeAuditLog(db, {
      actor,
      action: "document.processed",
      entityType: "document",
      entityId: document._id.toString(),
      metadata: {
        document_type: result.document_type,
        created_records: result.created_records || {},
      },
      req,
    });
    res.json(result);
  } catch (error) {
    console.error("process document failed", error);
    await writeFailureAuditLog(req, "document.processed", "document", req.params.id, error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Processing failed" });
  }
});

app.get("/api/documents/:id/file", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const bucket = await getBucket();
    const actor = getRequestUser(req);
    const document = await db.collection("documents").findOne({
      _id: toObjectId(req.params.id),
      user_id: actor.id,
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${document.file_name || `${crypto.randomUUID()}.bin`}"`);

    await writeAuditLog(db, {
      actor,
      action: "document.downloaded",
      entityType: "document",
      entityId: document._id.toString(),
      metadata: {
        file_name: document.file_name,
        mime_type: document.mime_type,
      },
      req,
    });

    bucket.openDownloadStream(document.gridfs_file_id).pipe(res);
  } catch (error) {
    console.error("download failed", error);
    await writeFailureAuditLog(req, "document.downloaded", "document", req.params.id, error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Download failed" });
  }
});

app.delete("/api/documents/:id", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const bucket = await getBucket();
    const documents = db.collection("documents");
    const documentId = toObjectId(req.params.id);
    const actor = getRequestUser(req);
    const document = await documents.findOne({
      _id: documentId,
      user_id: actor.id,
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    await db.collection("document_chunks").deleteMany({
      document_id: documentId,
      user_id: actor.id,
    });

    if (document.gridfs_file_id) {
      try {
        await bucket.delete(toObjectId(document.gridfs_file_id));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.toLowerCase().includes("file not found")) {
          throw error;
        }
      }
    }

    await documents.deleteOne({
      _id: documentId,
      user_id: actor.id,
    });

    await writeVersionSnapshot(db, {
      ownerUserId: actor.id,
      actor,
      entityType: "document",
      entityId: documentId.toString(),
      eventType: "deleted",
      before: serializeDoc(document),
      metadata: {
        title: document.title,
        file_name: document.file_name,
      },
    });

    await writeAuditLog(db, {
      actor,
      action: "document.deleted",
      entityType: "document",
      entityId: documentId.toString(),
      metadata: {
        title: document.title,
        file_name: document.file_name,
      },
      req,
    });

    res.status(204).end();
  } catch (error) {
    console.error("delete document failed", error);
    await writeFailureAuditLog(req, "document.deleted", "document", req.params.id, error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to delete document" });
  }
});

app.get("/api/qms/:entity", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const records = await listEntity(db, req.params.entity, actor.id);
    res.json(records);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to list records" });
  }
});

app.post("/api/qms/:entity", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const created = await createEntity(db, req.params.entity, actor.id, req.body);
    await writeVersionSnapshot(db, {
      ownerUserId: actor.id,
      actor,
      entityType: req.params.entity,
      entityId: created.id,
      eventType: "created",
      after: created,
    });
    await writeAuditLog(db, {
      actor,
      action: `${req.params.entity}.created`,
      entityType: req.params.entity,
      entityId: created.id || null,
      metadata: { record: created },
      req,
    });
    res.status(201).json(created);
  } catch (error) {
    await writeFailureAuditLog(req, `${req.params.entity}.created`, req.params.entity, null, error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create record" });
  }
});

app.patch("/api/qms/:entity/:id", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const beforeRecord = await db.collection(req.params.entity).findOne({
      _id: toObjectId(req.params.id),
      user_id: actor.id,
    });
    const updated = await updateEntity(db, req.params.entity, req.params.id, actor.id, req.body);
    await writeVersionSnapshot(db, {
      ownerUserId: actor.id,
      actor,
      entityType: req.params.entity,
      entityId: req.params.id,
      eventType: "updated",
      before: beforeRecord ? serializeDoc(beforeRecord) : null,
      after: updated,
      metadata: { changed_fields: Object.keys(req.body || {}) },
    });
    await writeAuditLog(db, {
      actor,
      action: `${req.params.entity}.updated`,
      entityType: req.params.entity,
      entityId: req.params.id,
      metadata: { changes: req.body, record: updated },
      req,
    });
    res.json(updated);
  } catch (error) {
    await writeFailureAuditLog(req, `${req.params.entity}.updated`, req.params.entity, req.params.id, error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update record" });
  }
});

app.delete("/api/qms/:entity/:id", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const actor = getRequestUser(req);
    const beforeRecord = await db.collection(req.params.entity).findOne({
      _id: toObjectId(req.params.id),
      user_id: actor.id,
    });
    await deleteEntity(db, req.params.entity, req.params.id, actor.id);
    await writeVersionSnapshot(db, {
      ownerUserId: actor.id,
      actor,
      entityType: req.params.entity,
      entityId: req.params.id,
      eventType: "deleted",
      before: beforeRecord ? serializeDoc(beforeRecord) : null,
    });
    await writeAuditLog(db, {
      actor,
      action: `${req.params.entity}.deleted`,
      entityType: req.params.entity,
      entityId: req.params.id,
      metadata: {},
      req,
    });
    res.status(204).end();
  } catch (error) {
    await writeFailureAuditLog(req, `${req.params.entity}.deleted`, req.params.entity, req.params.id, error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to delete record" });
  }
});

// --- Agent runs ---

app.get("/api/agent-runs", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const { agent_type, status, requires_human_review, limit } = req.query;
    const runs = await listAgentRuns(db, userId, {
      agentType: agent_type,
      status,
      requiresHumanReview:
        requires_human_review === "true" ? true
        : requires_human_review === "false" ? false
        : undefined,
      limit: limit ? Number(limit) : 50,
    });
    res.json(runs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list agent runs" });
  }
});

app.get("/api/agent-runs/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const run = await getAgentRun(db, userId, req.params.id);
    if (!run) return res.status(404).json({ error: "Agent run not found" });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to get agent run" });
  }
});

app.post("/api/agent-runs", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const run = await logAgentRun(db, { userId, ...req.body });
    res.status(201).json(run);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to log agent run" });
  }
});

app.patch("/api/agent-runs/:id/resolve", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const run = await resolveAgentRun(db, userId, req.params.id);
    if (!run) return res.status(404).json({ error: "Agent run not found" });
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to resolve agent run" });
  }
});

// --- Inspection agent trigger ---

app.post("/api/agents/inspection/:inspectionId", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const result = await runInspectionAgent(db, userId, req.params.inspectionId);
    res.json(result);
  } catch (error) {
    console.error("inspection agent failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Inspection agent failed" });
  }
});

// --- CAPA agent (separate pipeline; only CAPA-domain tools in capa-agent.js) ---

app.post("/api/agents/capa/run", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const options = req.body?.options && typeof req.body.options === "object" ? req.body.options : {};
    const result = await runCapaAgent(db, userId, options);
    res.json(result);
  } catch (error) {
    console.error("capa agent failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "CAPA agent failed" });
  }
});

app.post("/api/agents/supplier/run", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const options = req.body?.options && typeof req.body.options === "object" ? req.body.options : {};
    const result = await runSupplierAgent(db, userId, options);
    res.json(result);
  } catch (error) {
    console.error("supplier agent failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Supplier agent failed" });
  }
});

app.post("/api/agents/compliance/run", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const options = req.body?.options && typeof req.body.options === "object" ? req.body.options : {};
    const result = await runComplianceAgent(db, userId, options);
    res.json(result);
  } catch (error) {
    console.error("compliance agent failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Compliance agent failed" });
  }
});

app.get("/api/agents/compliance/items", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const db = await getDb();
    const limit = req.query.limit ? Number(req.query.limit) : 60;
    const items = await listComplianceAgentRiskItems(db, userId, { limit });
    res.json(items);
  } catch (error) {
    console.error("compliance items list failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list items" });
  }
});

// --- Startup ---

async function watchInspections(db) {
  try {
    const changeStream = db.collection("inspections").watch(
      [{ $match: { operationType: "insert" } }],
      { fullDocument: "updateLookup" }
    );

    changeStream.on("change", async (event) => {
      const doc = event.fullDocument;
      if (!doc?.user_id) return;
      console.log(`[InspectionAgent] New inspection detected: ${doc._id}`);
      try {
        await runInspectionAgent(db, doc.user_id, doc._id.toString());
        console.log(`[InspectionAgent] Completed for inspection ${doc._id}`);
      } catch (err) {
        console.error(`[InspectionAgent] Failed for inspection ${doc._id}:`, err.message);
      }
    });

    changeStream.on("error", (err) => {
      console.error("[InspectionAgent] Change stream error:", err.message);
    });

    console.log("[InspectionAgent] Watching inspections collection for new inserts...");
  } catch (err) {
    console.warn("[InspectionAgent] Change streams not available (replica set required). Manual trigger only.");
  }
}

async function watchNcrs(db) {
  try {
    const changeStream = db.collection("ncrs").watch([{ $match: { operationType: "insert" } }], {
      fullDocument: "updateLookup",
    });

    changeStream.on("change", async (event) => {
      const doc = event.fullDocument;
      if (!doc?.user_id) return;
      const sev = String(doc.severity || "").toLowerCase();
      if (!["critical", "major"].includes(sev)) return;
      console.log(`[CapaAgent] Critical/major NCR detected: ${doc._id} (${doc.severity})`);
      try {
        await runCapaAgentOnNcr(db, doc.user_id, doc._id.toString());
        console.log(`[CapaAgent] Completed pattern scan triggered by NCR ${doc._id}`);
      } catch (err) {
        console.error(`[CapaAgent] Failed for NCR ${doc._id}:`, err.message);
      }
    });

    changeStream.on("error", (err) => {
      console.error("[CapaAgent] Change stream error:", err.message);
    });

    console.log("[CapaAgent] Watching NCRs for critical/major inserts...");
  } catch (err) {
    console.warn("[CapaAgent] Change streams not available (replica set required). Manual trigger only.");
  }
}

async function start() {
  const db = await getDb();
  await ensureAgentRunsIndexes(db);
  await ensureCapaAgentIndexes(db);
  await ensureSupplierAgentIndexes(db);
  await ensureComplianceAgentIndexes(db);
  await watchInspections(db);
  await watchNcrs(db);
  app.listen(port, () => {
    console.log(`Inspectra Atlas API listening on http://127.0.0.1:${port}`);
  });
}

start();
