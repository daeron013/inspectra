import dotenv from "dotenv";
import crypto from "node:crypto";
import { Readable } from "node:stream";

import cors from "cors";
import express from "express";
import multer from "multer";

import { generateAssistantResponse, streamAssistantText } from "./assistant.js";
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

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: "10mb" }));

function requireUserId(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const query = req.query && typeof req.query === "object" ? req.query : {};
  const userId = body.userId || query.userId || req.header("x-user-id");
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return null;
  }
  return userId;
}

async function uploadBufferToGridFs(bucket, buffer, filename, metadata) {
  const stream = bucket.openUploadStream(filename, { metadata });
  await new Promise((resolve, reject) => {
    Readable.from(buffer).pipe(stream).on("finish", resolve).on("error", reject);
  });
  return stream.id;
}

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/assistant", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { messages } = req.body;
    if (!Array.isArray(messages)) {
      res.status(400).json({ error: "messages array required" });
      return;
    }

    const db = await getDb();
    const text = await generateAssistantResponse(db, userId, messages);
    streamAssistantText(text, res);
  } catch (error) {
    console.error("assistant failed", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : "Assistant failed" });
    } else {
      res.end();
    }
  }
});

app.get("/api/documents", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const documents = await listDocuments(db, userId);
    res.json(documents);
  } catch (error) {
    console.error("list documents failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to list documents" });
  }
});

app.post("/api/documents/upload", upload.array("files"), async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  if (!req.files?.length) {
    res.status(400).json({ error: "At least one file is required" });
    return;
  }

  try {
    const db = await getDb();
    const bucket = await getBucket();
    const documents = db.collection("documents");
    const now = new Date().toISOString();
    const created = [];

    for (const file of req.files) {
      const storageName = `${userId}/${Date.now()}_${file.originalname}`;
      const gridfsFileId = await uploadBufferToGridFs(bucket, file.buffer, storageName, {
        user_id: userId,
        original_name: file.originalname,
        mime_type: file.mimetype,
      });

      const doc = normalizeForMongo({
        user_id: userId,
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
      created.push(serializeDoc(saved));
    }

    res.status(201).json(created);
  } catch (error) {
    console.error("upload failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Upload failed" });
  }
});

app.post("/api/documents/:id/process", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const bucket = await getBucket();
    const document = await db.collection("documents").findOne({
      _id: toObjectId(req.params.id),
      user_id: userId,
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    const result = await processDocument(db, bucket, document);
    res.json(result);
  } catch (error) {
    console.error("process document failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Processing failed" });
  }
});

app.get("/api/documents/:id/file", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const bucket = await getBucket();
    const document = await db.collection("documents").findOne({
      _id: toObjectId(req.params.id),
      user_id: userId,
    });

    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    res.setHeader("Content-Type", document.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `inline; filename="${document.file_name || `${crypto.randomUUID()}.bin`}"`);

    bucket.openDownloadStream(document.gridfs_file_id).pipe(res);
  } catch (error) {
    console.error("download failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Download failed" });
  }
});

app.get("/api/qms/:entity", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const records = await listEntity(db, req.params.entity, userId);
    res.json(records);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to list records" });
  }
});

app.post("/api/qms/:entity", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    const created = await createEntity(db, req.params.entity, userId, req.body);
    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to create record" });
  }
});

app.patch("/api/qms/:entity/:id", async (req, res) => {
  try {
    const db = await getDb();
    const updated = await updateEntity(db, req.params.entity, req.params.id, req.body);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to update record" });
  }
});

app.delete("/api/qms/:entity/:id", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const db = await getDb();
    await deleteEntity(db, req.params.entity, req.params.id, userId);
    res.status(204).end();
  } catch (error) {
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

async function start() {
  const db = await getDb();
  await ensureAgentRunsIndexes(db);
  await watchInspections(db);
  app.listen(port, () => {
    console.log(`Inspectra Atlas API listening on http://127.0.0.1:${port}`);
  });
}

start();
