import { PDFParse } from "pdf-parse";

import { toObjectId } from "./db.js";
import { normalizeForMongo, upsertExtractedQmsData } from "./qms.js";

const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: {
      type: "string",
      enum: ["certificate", "inspection_report", "batch_record", "ncr_report", "capa_report", "sop", "spec", "other"],
    },
    confidence: { type: "number" },
    summary: { type: "string" },
    supplier: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        code: { type: "string" },
        address: { type: "string" },
        contact_email: { type: "string" },
        contact_phone: { type: "string" },
        certification_type: { type: "string" },
        certification_expiry: { type: "string" },
        risk_level: { type: "string" },
        status: { type: "string" },
        defect_rate: { type: "number" },
        on_time_delivery: { type: "number" },
        supplier_type: { type: "string" },
        country: { type: "string" },
        audit_score: { type: "number" },
        quality_agreement_signed: { type: "boolean" },
        approved_since: { type: "string" },
        last_audit_date: { type: "string" },
        next_audit_date: { type: "string" },
        last_requalification_date: { type: "string" },
        requalification_due_date: { type: "string" },
        requalification_frequency_days: { type: "number" },
        certifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              issuing_body: { type: "string" },
              certificate_number: { type: "string" },
              effective_date: { type: "string" },
              expiry_date: { type: "string" },
              status: { type: "string" },
            },
          },
        },
        audit_findings: {
          type: "array",
          items: {
            type: "object",
            properties: {
              finding: { type: "string" },
              severity: { type: "string" },
              status: { type: "string" },
            },
          },
        },
      },
    },
    part: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        part_number: { type: "string" },
        description: { type: "string" },
        risk_class: { type: "string" },
        fda_clearance: { type: "string" },
        unit_cost: { type: "number" },
        specifications: { type: "object" },
        material: { type: "string" },
        revision: { type: "string" },
        drawing_number: { type: "string" },
        critical_to_quality: { type: "boolean" },
        shelf_life_days: { type: "number" },
        sterilization_compatibility: { type: "string" },
        intended_use: { type: "string" },
      },
    },
    lot: {
      type: "object",
      additionalProperties: false,
      properties: {
        lot_number: { type: "string" },
        quantity: { type: "number" },
        received_date: { type: "string" },
        expiration_date: { type: "string" },
        status: { type: "string" },
        inspection_status: { type: "string" },
        batch_number: { type: "string" },
        manufacture_date: { type: "string" },
        certificate_of_conformance: { type: "string" },
        certificate_of_analysis: { type: "string" },
        traceability_notes: { type: "string" },
        serial_numbers: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    inspection: {
      type: "object",
      additionalProperties: false,
      properties: {
        inspection_type: { type: "string" },
        inspection_date: { type: "string" },
        inspector_name: { type: "string" },
        sample_size: { type: "number" },
        defects_found: { type: "number" },
        status: { type: "string" },
        notes: { type: "string" },
        rejected_units: { type: "number" },
        sampling_plan: { type: "string" },
        aql_level: { type: "string" },
        acceptance_criteria: { type: "string" },
        equipment_used: {
          type: "array",
          items: { type: "string" },
        },
        environmental_conditions: { type: "string" },
        defect_categories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              count: { type: "number" },
              severity: { type: "string" },
            },
          },
        },
        measurements: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              parameter: { type: "string" },
              value: { type: "string" },
              spec_min: { type: "string" },
              spec_max: { type: "string" },
              unit: { type: "string" },
              result: { type: "string" },
            },
          },
        },
      },
    },
    ncr: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        severity: { type: "string" },
        disposition: { type: "string" },
        root_cause: { type: "string" },
        corrective_action: { type: "string" },
        detected_date: { type: "string" },
        detection_source: { type: "string" },
        disposition_reason: { type: "string" },
        containment_action: { type: "string" },
        impact_assessment: { type: "string" },
        affected_quantity: { type: "number" },
      },
    },
    capa: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        type: { type: "string" },
        priority: { type: "string" },
        root_cause: { type: "string" },
        action_plan: { type: "string" },
        assigned_to: { type: "string" },
        due_date: { type: "string" },
        effectiveness_check: { type: "string" },
        trigger_reason: { type: "string" },
        verification_method: { type: "string" },
        effectiveness_due_date: { type: "string" },
        recurrence_risk: { type: "string" },
      },
    },
    document_control: {
      type: "object",
      additionalProperties: false,
      properties: {
        document_number: { type: "string" },
        title: { type: "string" },
        version: { type: "string" },
        revision: { type: "string" },
        effective_date: { type: "string" },
        approval_date: { type: "string" },
        obsolete_date: { type: "string" },
        document_owner: { type: "string" },
        form_number: { type: "string" },
        sop_reference: { type: "string" },
        change_summary: { type: "string" },
        controlled_copy: { type: "boolean" },
        approvers: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    compliance: {
      type: "object",
      additionalProperties: false,
      properties: {
        iso_13485_clauses: {
          type: "array",
          items: { type: "string" },
        },
        fda_21_cfr_820_sections: {
          type: "array",
          items: { type: "string" },
        },
        audit_readiness_flags: {
          type: "array",
          items: { type: "string" },
        },
        requires_requalification: { type: "boolean" },
        requires_supplier_audit: { type: "boolean" },
        missing_records: {
          type: "array",
          items: { type: "string" },
        },
        upcoming_deadlines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              item: { type: "string" },
              due_date: { type: "string" },
              priority: { type: "string" },
            },
          },
        },
      },
    },
    traceability: {
      type: "object",
      additionalProperties: false,
      properties: {
        supplier_batch: { type: "string" },
        internal_lot: { type: "string" },
        receiving_record: { type: "string" },
        finished_device_ids: {
          type: "array",
          items: { type: "string" },
        },
        affected_products: {
          type: "array",
          items: { type: "string" },
        },
        source_documents: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
  required: ["document_type", "confidence", "summary"],
};

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requireGeminiApiKey() {
  return requireEnv("GEMINI_API_KEY");
}

function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function geminiEmbeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}

function extractGeminiText(json) {
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

function toGeminiSchema(schema) {
  if (Array.isArray(schema)) {
    return schema.map(toGeminiSchema);
  }

  if (!schema || typeof schema !== "object") {
    return schema;
  }

  const next = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === "additionalProperties") continue;
    next[key] = toGeminiSchema(value);
  }
  return next;
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function readGridFsFile(bucket, fileId) {
  const stream = bucket.openDownloadStream(toObjectId(fileId));
  return readStream(stream);
}

export function detectTypeFromName(fileName = "") {
  const lower = fileName.toLowerCase();
  if (lower.includes("certificate") || lower.includes("cert") || lower.includes("coc") || lower.includes("coa")) return "certificate";
  if (lower.includes("inspection")) return "inspection_report";
  if (lower.includes("batch") || lower.includes("lot")) return "batch_record";
  if (lower.includes("ncr") || lower.includes("nonconform")) return "ncr_report";
  if (lower.includes("capa")) return "capa_report";
  if (lower.includes("sop")) return "sop";
  if (lower.includes("spec")) return "spec";
  return "other";
}

export async function extractDocumentText(fileBuffer, fileName) {
  const lower = (fileName || "").toLowerCase();

  if (lower.endsWith(".pdf")) {
    const parser = new PDFParse({ data: new Uint8Array(fileBuffer) });
    try {
      const result = await parser.getText();
      return result.text?.trim() || "";
    } finally {
      await parser.destroy();
    }
  }

  if (/\.(txt|csv|json|md)$/i.test(lower)) {
    return fileBuffer.toString("utf8");
  }

  return "";
}

export function chunkText(text, size = 1600, overlap = 250) {
  if (!text.trim()) return [];

  const chunks = [];
  let cursor = 0;

  while (cursor < text.length) {
    const end = Math.min(cursor + size, text.length);
    const chunk = text.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    cursor = Math.max(end - overlap, cursor + 1);
  }

  return chunks;
}

async function createEmbeddings(chunks) {
  const apiKey = requireGeminiApiKey();
  const model = geminiEmbeddingModel();

  return Promise.all(
    chunks.map(async (chunk) => {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: {
              parts: [{ text: chunk }],
            },
            taskType: "RETRIEVAL_DOCUMENT",
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Embedding request failed: ${response.status} ${body}`);
      }

      const json = await response.json();
      return json.embedding?.values || [];
    }),
  );
}

async function retrieveRelevantChunks(db, { documentId, query, fallbackChunks = [] }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const indexName = process.env.MONGODB_ATLAS_VECTOR_INDEX;
  if (!apiKey || !indexName) {
    return fallbackChunks.slice(0, 6);
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiEmbeddingModel()}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: {
          parts: [{ text: query }],
        },
        taskType: "RETRIEVAL_QUERY",
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Query embedding request failed: ${response.status} ${body}`);
  }

  const queryJson = await response.json();
  const queryEmbedding = queryJson.embedding?.values || [];
  const results = await db.collection("document_chunks").aggregate([
    {
      $vectorSearch: {
        index: indexName,
        path: "embedding",
        queryVector: queryEmbedding,
        numCandidates: 25,
        limit: 6,
        filter: {
          document_id: toObjectId(documentId),
        },
      },
    },
    {
      $project: {
        _id: 0,
        text: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();

  if (!results.length) {
    return fallbackChunks.slice(0, 6);
  }

  return results.map((entry) => entry.text);
}

async function extractStructuredData({ fileName, excerpts }) {
  const apiKey = requireGeminiApiKey();
  const model = geminiModel();

  const systemPrompt = [
    "You classify and extract quality-management documents for a medical-device QMS.",
    "Use the supplied excerpts only.",
    "Return valid JSON only.",
    "Infer the most likely document_type from the evidence in the text.",
    "Populate supplier, part, lot, inspection, ncr, and capa only when the document supports them.",
    "Summarize the document concisely and preserve important identifiers, dates, measurements, and statuses.",
  ].join(" ");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  `Filename: ${fileName || "unknown"}`,
                  "",
                  "Relevant excerpts:",
                  excerpts.map((chunk, index) => `Chunk ${index + 1}:\n${chunk}`).join("\n\n"),
                ].join("\n"),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(EXTRACTION_SCHEMA),
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Extraction request failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = extractGeminiText(json);
  if (!content) {
    throw new Error("Extraction response did not include JSON content");
  }

  return JSON.parse(content);
}

async function storeChunks(db, { documentId, userId, chunks, embeddings }) {
  const collection = db.collection("document_chunks");
  await collection.deleteMany({ document_id: toObjectId(documentId) });

  if (!chunks.length) return;

  await collection.insertMany(
    chunks.map((chunk, index) =>
      normalizeForMongo({
        document_id: documentId,
        user_id: userId,
        chunk_index: index,
        text: chunk,
        embedding: embeddings[index],
        created_at: new Date().toISOString(),
      }),
    ),
  );
}

export async function processDocument(db, bucket, document) {
  const documents = db.collection("documents");
  const documentId = document._id.toString();
  const now = new Date().toISOString();

  await documents.updateOne(
    { _id: document._id },
    { $set: { status: "processing", updated_at: now } },
  );

  let buffer;
  try {
    buffer = await readGridFsFile(bucket, document.gridfs_file_id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid GridFS file reference";
    await documents.updateOne(
      { _id: document._id },
      {
        $set: {
          status: "flagged",
          notes: "Document file reference is invalid. Re-upload this document.",
          updated_at: new Date().toISOString(),
        },
      },
    );
    throw new Error(`Document file reference is invalid. Re-upload this document. (${message})`);
  }
  const text = await extractDocumentText(buffer, document.file_name);

  if (!text.trim()) {
    const fallbackType = detectTypeFromName(document.file_name);
    await documents.updateOne(
      { _id: document._id },
      {
        $set: {
          status: "flagged",
          document_type: fallbackType,
          notes: "No extractable text was found in the uploaded file.",
          updated_at: new Date().toISOString(),
        },
      },
    );
    return {
      success: false,
      document_type: fallbackType,
      summary: "No extractable text was found in the uploaded file.",
      confidence: 0,
      created_records: {},
    };
  }

  const chunks = chunkText(text);
  const embeddings = await createEmbeddings(chunks);
  await storeChunks(db, {
    documentId,
    userId: document.user_id,
    chunks,
    embeddings,
  });

  const retrievedChunks = await retrieveRelevantChunks(db, {
    documentId,
    query: "Identify the document type and extract supplier, part, lot, inspection, nonconformance, and CAPA data with key identifiers, dates, and measurements.",
    fallbackChunks: chunks,
  });

  const extracted = await extractStructuredData({
    fileName: document.file_name,
    excerpts: retrievedChunks,
  });

  const createdRecords = await upsertExtractedQmsData(db, {
    documentId,
    userId: document.user_id,
    extracted,
  });

  await documents.updateOne(
    { _id: document._id },
    {
      $set: normalizeForMongo({
        document_type: extracted.document_type || detectTypeFromName(document.file_name),
        title: extracted.document_control?.title || document.title,
        version: extracted.document_control?.version || document.version || "1.0",
        document_number: extracted.document_control?.document_number || null,
        revision: extracted.document_control?.revision || null,
        effective_date: extracted.document_control?.effective_date || null,
        approval_date: extracted.document_control?.approval_date || null,
        obsolete_date: extracted.document_control?.obsolete_date || null,
        document_owner: extracted.document_control?.document_owner || null,
        form_number: extracted.document_control?.form_number || null,
        sop_reference: extracted.document_control?.sop_reference || null,
        change_summary: extracted.document_control?.change_summary || null,
        controlled_copy: extracted.document_control?.controlled_copy ?? null,
        approvers: extracted.document_control?.approvers || null,
        compliance_signals: extracted.compliance || null,
        traceability_map: extracted.traceability || null,
        status: "processed",
        extracted_text: text.slice(0, 20000),
        extracted_data: extracted,
        notes: extracted.summary,
        updated_at: new Date().toISOString(),
      }),
    },
  );

  return {
    success: true,
    document_type: extracted.document_type,
    summary: extracted.summary,
    confidence: extracted.confidence,
    created_records: createdRecords,
  };
}
