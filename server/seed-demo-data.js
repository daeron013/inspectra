import dotenv from "dotenv";

import { getDb, ObjectId } from "./db.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

function parseArgs(argv) {
  const options = {
    scope: process.env.DEMO_SCOPE || process.env.DEMO_ORG_ID || "demo-org",
    orgName: process.env.DEMO_ORG_NAME || "Acme Medical Devices",
    reset: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--scope" && argv[index + 1]) {
      options.scope = argv[index + 1];
      index += 1;
    } else if (arg === "--org-name" && argv[index + 1]) {
      options.orgName = argv[index + 1];
      index += 1;
    } else if (arg === "--reset") {
      options.reset = true;
    }
  }

  return options;
}

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function baseRecord(scope, orgName, overrides = {}) {
  return {
    user_id: scope,
    organization_id: scope,
    organization_name: orgName,
    created_by_user_id: "demo-seed",
    created_at: overrides.created_at || new Date().toISOString(),
    updated_at: overrides.updated_at || overrides.created_at || new Date().toISOString(),
    ...overrides,
  };
}

async function clearScope(db, scope) {
  const collections = [
    "documents",
    "document_chunks",
    "suppliers",
    "parts",
    "lots",
    "devices",
    "device_lots",
    "inspections",
    "ncrs",
    "capas",
    "agent_runs",
    "compliance_agent_risk_items",
    "compliance_agent_notifications",
    "supplier_agent_notifications",
    "capa_agent_notifications",
    "audit_logs",
    "version_snapshots",
  ];

  for (const name of collections) {
    const filter =
      name === "device_lots"
        ? { user_id: scope }
        : { user_id: scope };
    await db.collection(name).deleteMany(filter);
  }
}

async function seedDemoData(db, scope, orgName) {
  const suppliersCollection = db.collection("suppliers");
  const partsCollection = db.collection("parts");
  const lotsCollection = db.collection("lots");
  const devicesCollection = db.collection("devices");
  const deviceLotsCollection = db.collection("device_lots");
  const inspectionsCollection = db.collection("inspections");
  const ncrsCollection = db.collection("ncrs");
  const capasCollection = db.collection("capas");
  const documentsCollection = db.collection("documents");
  const agentRunsCollection = db.collection("agent_runs");

  const supplierDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "Nova Precision Plastics",
      status: "approved",
      risk_level: "medium",
      supplier_type: "Injection Molding",
      contact_email: "quality@novaprecision.example",
      contact_phone: "+1-555-0101",
      address: "415 Harbor Park Dr, Irvine, CA",
      certification_type: "ISO 13485",
      certification_expiry: isoDaysFromNow(210),
      last_audit_date: isoDaysAgo(42),
      next_audit_date: isoDaysFromNow(48),
      audit_score: 92,
      requalification_due_date: isoDaysFromNow(44),
      quality_agreement_signed: true,
      defect_rate: 1.7,
      on_time_delivery_rate: 97,
      notes: "Primary molded housing supplier for catheter kit program.",
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "SteriCore Packaging",
      status: "conditional",
      risk_level: "high",
      supplier_type: "Sterile Packaging",
      contact_email: "qa@stericore.example",
      contact_phone: "+1-555-0142",
      address: "2080 Innovation Way, Austin, TX",
      certification_type: "ISO 13485 / ISO 11607",
      certification_expiry: isoDaysFromNow(23),
      last_audit_date: isoDaysAgo(104),
      next_audit_date: isoDaysFromNow(7),
      audit_score: 78,
      requalification_due_date: isoDaysFromNow(5),
      quality_agreement_signed: true,
      defect_rate: 4.9,
      on_time_delivery_rate: 88,
      notes: "Packaging seal integrity issues trended upward over the last two lots.",
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "BioSignal Electronics",
      status: "approved",
      risk_level: "low",
      supplier_type: "Electronics Assembly",
      contact_email: "suppliercare@biosignal.example",
      contact_phone: "+1-555-0178",
      address: "91 Circuit Ave, Nashua, NH",
      certification_type: "ISO 13485 / IPC-A-610",
      certification_expiry: isoDaysFromNow(300),
      last_audit_date: isoDaysAgo(18),
      next_audit_date: isoDaysFromNow(86),
      audit_score: 96,
      requalification_due_date: isoDaysFromNow(90),
      quality_agreement_signed: true,
      defect_rate: 0.8,
      on_time_delivery_rate: 99,
      notes: "Supplier for PCB and sensor harness subassemblies.",
    }),
  ];

  await suppliersCollection.insertMany(supplierDocs);

  const [nova, stericore, biosignal] = supplierDocs;

  const partDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "Catheter Hub Housing",
      part_number: "A100-CH",
      drawing_number: "DWG-A100-CH-07",
      revision: "R7",
      material: "Polycarbonate",
      ctq_flag: true,
      status: "active",
      supplier_id: nova._id,
      intended_use: "Main molded housing for catheter access system",
      shelf_life_months: 36,
      source_document_ids: [],
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "Sterile Barrier Pouch",
      part_number: "PKG-221",
      drawing_number: "PKG-221-03",
      revision: "R3",
      material: "Tyvek / PET laminate",
      ctq_flag: true,
      status: "active",
      supplier_id: stericore._id,
      intended_use: "Primary sterile packaging",
      shelf_life_months: 24,
      source_document_ids: [],
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      name: "Pressure Sensor PCB",
      part_number: "PCB-778",
      drawing_number: "ELEC-778-11",
      revision: "R11",
      material: "FR4",
      ctq_flag: true,
      status: "active",
      supplier_id: biosignal._id,
      intended_use: "Pressure sensing subsystem",
      shelf_life_months: 60,
      source_document_ids: [],
    }),
  ];

  await partsCollection.insertMany(partDocs);
  const [hubHousing, pouch, sensorPcb] = partDocs;

  const lotDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      lot_number: "LOT-4821",
      batch_number: "BATCH-4821",
      part_id: hubHousing._id,
      supplier_id: nova._id,
      quantity: 500,
      status: "released",
      manufacturing_date: isoDaysAgo(17),
      received_date: isoDaysAgo(12),
      expiry_date: isoDaysFromNow(700),
      certificate_of_conformance: "COC-4821",
      certificate_of_analysis: "COA-4821",
      serial_numbers: ["SN4821-001", "SN4821-002", "SN4821-003"],
      traceability_notes: "Released to finished device line A after dimensional verification.",
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      lot_number: "LOT-4902",
      batch_number: "BATCH-4902",
      part_id: pouch._id,
      supplier_id: stericore._id,
      quantity: 1000,
      status: "quarantine",
      manufacturing_date: isoDaysAgo(8),
      received_date: isoDaysAgo(5),
      expiry_date: isoDaysFromNow(420),
      certificate_of_conformance: "COC-4902",
      certificate_of_analysis: "COA-4902",
      serial_numbers: [],
      traceability_notes: "Seal strength failures detected during incoming inspection.",
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      lot_number: "LOT-4750",
      batch_number: "BATCH-4750",
      part_id: sensorPcb._id,
      supplier_id: biosignal._id,
      quantity: 220,
      status: "inspection_pending",
      manufacturing_date: isoDaysAgo(3),
      received_date: isoDaysAgo(1),
      expiry_date: isoDaysFromNow(900),
      certificate_of_conformance: "COC-4750",
      certificate_of_analysis: "COA-4750",
      serial_numbers: ["PCB4750-01", "PCB4750-02"],
      traceability_notes: "Awaiting functional verification against calibration rig.",
    }),
  ];

  await lotsCollection.insertMany(lotDocs);
  const [lot4821, lot4902, lot4750] = lotDocs;

  const deviceDoc = baseRecord(scope, orgName, {
    _id: new ObjectId(),
    device_name: "VenaGuide Access Kit",
    device_code: "VG-100",
    revision: "R4",
    status: "active",
    intended_use: "Single-use vascular access device",
  });
  await devicesCollection.insertOne(deviceDoc);

  await deviceLotsCollection.insertMany([
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      device_id: deviceDoc._id,
      lot_id: lot4821._id,
      quantity_used: 180,
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      device_id: deviceDoc._id,
      lot_id: lot4750._id,
      quantity_used: 95,
    }),
  ]);

  const inspectionDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      inspection_number: "INSP-4821",
      lot_id: lot4821._id,
      part_id: hubHousing._id,
      supplier_id: nova._id,
      inspection_type: "incoming",
      inspector_name: "Maya Chen",
      status: "passed",
      sample_size: 50,
      defects_found: 1,
      rejected_units: 0,
      acceptance_criteria: "Critical dimensions within ±0.05mm, no flash or sink marks",
      sampling_plan: "ANSI Z1.4 General II",
      aql_level: "1.0",
      measured_values: [{ dimension: "hub_width", observed: "12.01mm", spec: "12.00 ±0.05mm" }],
      environment: "Receiving Lab 2",
      equipment_used: ["Mitutoyo Digital Caliper", "Visual Comparator"],
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      inspection_number: "INSP-4902",
      lot_id: lot4902._id,
      part_id: pouch._id,
      supplier_id: stericore._id,
      inspection_type: "incoming",
      inspector_name: "Jordan Patel",
      status: "failed",
      sample_size: 80,
      defects_found: 6,
      rejected_units: 6,
      acceptance_criteria: "Seal strength minimum 1.5N and dye penetration free",
      sampling_plan: "ANSI Z1.4 Tightened",
      aql_level: "0.65",
      measured_values: [{ test: "seal_strength", observed: "1.18N avg", spec: ">= 1.5N" }],
      environment: "Packaging QA Lab",
      equipment_used: ["Seal Strength Tester", "Dye Penetration Bench"],
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      inspection_number: "INSP-4750",
      lot_id: lot4750._id,
      part_id: sensorPcb._id,
      supplier_id: biosignal._id,
      inspection_type: "incoming",
      inspector_name: "Alina Brooks",
      status: "pending",
      sample_size: 32,
      defects_found: 0,
      rejected_units: 0,
      acceptance_criteria: "Functional calibration and visual IPC class 2 workmanship",
      sampling_plan: "Reduced plan",
      aql_level: "1.5",
      measured_values: [],
      environment: "Electronics Validation Lab",
      equipment_used: ["Calibration Rig CR-9"],
    }),
  ];

  await inspectionsCollection.insertMany(inspectionDocs);
  const [, failedInspection] = inspectionDocs;

  const ncrDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      ncr_number: "NCR-1042",
      title: "Seal strength below specification on sterile pouch lot 4902",
      status: "open",
      severity: "major",
      part_id: pouch._id,
      supplier_id: stericore._id,
      lot_id: lot4902._id,
      disposition: "quarantine",
      root_cause: "Suspected packaging line temperature drift",
      containment_action: "Segregated full lot and blocked release to production",
      affected_quantity: 1000,
      description: "Incoming inspection identified 6/80 units below minimum seal strength requirement.",
      source: "inspection_agent",
      capa_opened: true,
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      ncr_number: "NCR-1031",
      title: "Label placement drift on packaging pouch artwork",
      status: "closed",
      severity: "minor",
      part_id: pouch._id,
      supplier_id: stericore._id,
      lot_id: lot4902._id,
      disposition: "rework",
      root_cause: "Fixture wear on print and apply station",
      containment_action: "Reworked affected inventory and replaced fixture",
      affected_quantity: 120,
      description: "Legacy issue kept as precedent for recurring packaging drift review.",
      source: "manual",
      capa_opened: false,
      updated_at: isoDaysAgo(14),
    }),
  ];

  await ncrsCollection.insertMany(ncrDocs);
  const [openNcr] = ncrDocs;

  const capaDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      capa_number: "CAPA-204",
      title: "Correct packaging seal strength process drift at SteriCore",
      ncr_id: openNcr._id,
      status: "implementation",
      priority: "high",
      root_cause: "Sealer calibration and preventive maintenance interval insufficient",
      action_plan: "Require supplier recalibration, add incoming seal audit for next three lots, update supplier risk classification",
      effectiveness_check: "Pass three consecutive lots with no seal strength failures",
      owner_name: "Priya Raman",
      due_date: isoDaysFromNow(18),
      effectiveness_due_date: isoDaysFromNow(45),
      recurrence_risk: "medium",
      source: "capa_agent",
    }),
  ];

  await capasCollection.insertMany(capaDocs);

  const documentDocs = [
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      title: "Nova Precision ISO 13485 Certificate",
      document_type: "supplier_certificate",
      version: "3.1",
      status: "processed",
      file_name: "nova-precision-iso13485.pdf",
      mime_type: "application/pdf",
      file_size: 248321,
      notes: "Current supplier certification on file.",
      linked_supplier_id: nova._id,
      extracted_data: {
        summary: "ISO 13485 certificate valid for Nova Precision Plastics.",
        supplier: {
          name: nova.name,
          certification_type: nova.certification_type,
          audit_score: nova.audit_score,
          requalification_due_date: nova.requalification_due_date,
          quality_agreement_signed: true,
        },
      },
      compliance_signals: {
        iso_13485_clauses: ["7.4 Purchasing", "4.2 Documentation"],
        audit_readiness_flags: [],
        missing_records: [],
      },
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      title: "Incoming Inspection Report LOT-4902",
      document_type: "inspection_sheet",
      version: "1.0",
      status: "flagged",
      file_name: "inspection-lot-4902.pdf",
      mime_type: "application/pdf",
      file_size: 184912,
      notes: "Failed incoming inspection. Linked NCR opened.",
      linked_supplier_id: stericore._id,
      linked_lot_id: lot4902._id,
      linked_ncr_id: openNcr._id,
      extracted_data: {
        summary: "Incoming inspection failed due to seal strength below spec.",
        inspection: {
          inspection_type: failedInspection.inspection_type,
          inspector_name: failedInspection.inspector_name,
          sample_size: failedInspection.sample_size,
          defects_found: failedInspection.defects_found,
          rejected_units: failedInspection.rejected_units,
          acceptance_criteria: failedInspection.acceptance_criteria,
          sampling_plan: failedInspection.sampling_plan,
          aql_level: failedInspection.aql_level,
        },
        ncr: {
          title: openNcr.title,
          disposition: openNcr.disposition,
          root_cause: openNcr.root_cause,
          containment_action: openNcr.containment_action,
        },
      },
      compliance_signals: {
        iso_13485_clauses: ["8.3 Control of Nonconforming Product", "8.5 CAPA"],
        audit_readiness_flags: ["Major supplier packaging failure under investigation"],
        missing_records: ["CAPA effectiveness evidence pending"],
      },
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      title: "SteriCore CAPA Follow-up Plan",
      document_type: "capa_report",
      version: "1.0",
      status: "processed",
      file_name: "capa-204-follow-up.pdf",
      mime_type: "application/pdf",
      file_size: 211442,
      notes: "CAPA package for SteriCore packaging drift issue.",
      linked_supplier_id: stericore._id,
      linked_ncr_id: openNcr._id,
      extracted_data: {
        summary: "Corrective and preventive action package for packaging seal integrity drift.",
        capa: {
          title: capaDocs[0].title,
          root_cause: capaDocs[0].root_cause,
          action_plan: capaDocs[0].action_plan,
          effectiveness_check: capaDocs[0].effectiveness_check,
        },
      },
      compliance_signals: {
        iso_13485_clauses: ["8.5 CAPA"],
        audit_readiness_flags: ["Monitor effectiveness review due in 45 days"],
        missing_records: [],
      },
    }),
  ];

  await documentsCollection.insertMany(documentDocs);

  await agentRunsCollection.insertMany([
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      agent_type: "inspection",
      status: "completed",
      requires_human_review: false,
      title: "Processed failed packaging inspection",
      summary: "Inspection Agent identified seal strength failures and recommended NCR creation.",
      related_record_type: "inspection",
      related_record_id: failedInspection._id.toString(),
    }),
    baseRecord(scope, orgName, {
      _id: new ObjectId(),
      agent_type: "capa",
      status: "completed",
      requires_human_review: true,
      title: "Generated CAPA recommendation for SteriCore",
      summary: "CAPA Agent linked recurring packaging issues and opened CAPA-204.",
      related_record_type: "capa",
      related_record_id: capaDocs[0]._id.toString(),
    }),
  ]);

  return {
    suppliers: supplierDocs.length,
    parts: partDocs.length,
    lots: lotDocs.length,
    devices: 1,
    inspections: inspectionDocs.length,
    ncrs: ncrDocs.length,
    capas: capaDocs.length,
    documents: documentDocs.length,
    agent_runs: 2,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = await getDb();

  if (options.reset) {
    await clearScope(db, options.scope);
  }

  const counts = await seedDemoData(db, options.scope, options.orgName);
  console.log(
    JSON.stringify(
      {
        ok: true,
        scope: options.scope,
        organization_name: options.orgName,
        reset: options.reset,
        inserted: counts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
