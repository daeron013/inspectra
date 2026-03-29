#!/usr/bin/env node
/**
 * Inserts a stub document and applies a fixed extraction payload so supplier,
 * part, and lot records appear without running Gemini (same shape as upload→process).
 *
 * Usage (from repo root, MONGODB_URI in .env.local):
 *   node scripts/seed-demo-qms.mjs "<user_id>"
 *   npm run seed:demo-qms -- "<user_id>"
 *
 * user_id must match the app's scoped user (e.g. Auth0 sub like auth0|xxxx).
 */

import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const userId = process.argv[2] || process.env.SEED_USER_ID;
if (!userId) {
  console.error("Usage: node scripts/seed-demo-qms.mjs <user_id>");
  console.error("   or: SEED_USER_ID=<user_id> node scripts/seed-demo-qms.mjs");
  process.exit(1);
}

const { getDb } = await import("../server/db.js");
const { upsertExtractedQmsData, normalizeForMongo } = await import("../server/qms.js");

const extracted = {
  document_type: "certificate",
  confidence: 1,
  summary:
    "Demo certificate: Demo Sterile Components LLC, part PN-DEMO-8842, lot LOT-DEMO-2025-03 (seed script).",
  supplier: {
    name: "Demo Sterile Components LLC",
    code: "DEMO-SUP-001",
    contact_email: "quality@demosterile.example",
    contact_phone: "+1-555-0100",
    address: "100 Quality Way, Boston, MA 02110, USA",
    country: "USA",
    supplier_type: "Contract manufacturer",
    certification_type: "ISO 13485:2016",
    certification_expiry: "2027-06-30",
    status: "approved",
    risk_level: "medium",
    quality_agreement_signed: true,
    approved_since: "2024-01-15",
    audit_score: 92,
    on_time_delivery: 97,
    defect_rate: 0.4,
    last_audit_date: "2025-08-01",
    next_audit_date: "2026-08-01",
    last_requalification_date: "2025-03-15",
    requalification_due_date: "2026-03-15",
    requalification_frequency_days: 365,
  },
  part: {
    part_number: "PN-DEMO-8842",
    name: "Implant-grade polymer housing",
    description: "Demo component for catalog, traceability, and supplier linkage.",
    risk_class: "III",
    fda_clearance: "K123456",
    drawing_number: "DWG-8842-RevC",
    revision: "C",
    material: "Medical-grade PEEK",
    unit_cost: 12.5,
  },
  lot: {
    lot_number: "LOT-DEMO-2025-03",
    batch_number: "BTH-99122",
    quantity: 2400,
    received_date: "2026-01-10",
    expiration_date: "2028-01-10",
    status: "approved",
    inspection_status: "pending",
    manufacture_date: "2025-11-20",
    certificate_of_conformance: "CoC-DEMO-2025-03",
    certificate_of_analysis: "CoA-DEMO-2025-03-A1",
  },
};

const db = await getDb();
const documents = db.collection("documents");
const now = new Date().toISOString();

const docInsert = await documents.insertOne(
  normalizeForMongo({
    user_id: userId,
    title: "Demo QMS certificate (seed)",
    document_type: "certificate",
    version: "1.0",
    status: "processed",
    file_name: "demo-qms-certificate-seed.txt",
    file_size: 0,
    mime_type: "text/plain",
    notes: "Created by scripts/seed-demo-qms.mjs — not a real GridFS upload.",
    extracted_data: extracted,
    created_at: now,
    updated_at: now,
  }),
);

const documentId = docInsert.insertedId.toString();
const createdRecords = await upsertExtractedQmsData(db, { documentId, userId, extracted });

console.log("Demo QMS seed complete for user_id:", userId);
console.log("Document id:", documentId);
console.log("Created / updated records:", createdRecords);

process.exit(0);
