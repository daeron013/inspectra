import crypto from "node:crypto";

import { ObjectId } from "./db.js";

const ENTITY_COLLECTIONS = new Set([
  "suppliers",
  "parts",
  "lots",
  "devices",
  "device_lots",
  "inspections",
  "ncrs",
  "capas",
]);

const OBJECT_ID_FIELDS = new Set([
  "_id",
  "supplier_id",
  "part_id",
  "lot_id",
  "ncr_id",
  "device_id",
  "gridfs_file_id",
  "linked_supplier_id",
  "linked_lot_id",
  "linked_ncr_id",
  "document_id",
]);

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof ObjectId) &&
    !(value instanceof Date)
  );
}

function maybeObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  return value;
}

export function normalizeForMongo(value, key = "") {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForMongo(item));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        normalizeForMongo(entryValue, entryKey),
      ]),
    );
  }

  if (OBJECT_ID_FIELDS.has(key)) {
    return maybeObjectId(value);
  }

  return value;
}

export function serializeDoc(value) {
  if (Array.isArray(value)) {
    return value.map((item) => serializeDoc(item));
  }

  if (value instanceof ObjectId) {
    return value.toString();
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [key, entryValue] of Object.entries(value)) {
      if (key === "_id") {
        output.id = serializeDoc(entryValue);
      } else {
        output[key] = serializeDoc(entryValue);
      }
    }
    return output;
  }

  return value;
}

function nowIso() {
  return new Date().toISOString();
}

function requireEntity(entity) {
  if (!ENTITY_COLLECTIONS.has(entity)) {
    throw new Error(`Unsupported entity collection: ${entity}`);
  }
}

function recordCode(prefix) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function appendSourceDocument(existingValue, documentId) {
  return uniqueValues([...(Array.isArray(existingValue) ? existingValue : []), documentId]);
}

async function buildMaps(db, userId) {
  const [suppliers, parts, lots, ncrs] = await Promise.all([
    db.collection("suppliers").find({ user_id: userId }).toArray(),
    db.collection("parts").find({ user_id: userId }).toArray(),
    db.collection("lots").find({ user_id: userId }).toArray(),
    db.collection("ncrs").find({ user_id: userId }).toArray(),
  ]);

  return {
    suppliers: new Map(suppliers.map((doc) => [doc._id.toString(), doc])),
    parts: new Map(parts.map((doc) => [doc._id.toString(), doc])),
    lots: new Map(lots.map((doc) => [doc._id.toString(), doc])),
    ncrs: new Map(ncrs.map((doc) => [doc._id.toString(), doc])),
  };
}

function enrichEntity(entity, items, maps, deviceLots = []) {
  switch (entity) {
    case "parts":
      return items.map((item) => ({
        ...item,
        suppliers: item.supplier_id ? { name: maps.suppliers.get(item.supplier_id)?.name ?? "Unknown" } : null,
      }));
    case "lots":
      return items.map((item) => {
        const part = item.part_id ? maps.parts.get(item.part_id) : null;
        return {
          ...item,
          parts: part ? { name: part.name, part_number: part.part_number } : null,
          suppliers: item.supplier_id ? { name: maps.suppliers.get(item.supplier_id)?.name ?? "Unknown" } : null,
        };
      });
    case "devices":
      return items.map((item) => ({
        ...item,
        device_lots: deviceLots
          .filter((entry) => entry.device_id === item.id)
          .map((entry) => {
            const lot = maps.lots.get(entry.lot_id);
            const part = lot?.part_id ? maps.parts.get(lot.part_id) : null;
            return {
              ...entry,
              lots: lot
                ? {
                    lot_number: lot.lot_number,
                    status: lot.status,
                    parts: part ? { name: part.name, part_number: part.part_number } : null,
                  }
                : null,
            };
          }),
      }));
    case "inspections":
      return items.map((item) => {
        const lot = item.lot_id ? maps.lots.get(item.lot_id) : null;
        const part = lot?.part_id ? maps.parts.get(lot.part_id) : null;
        return {
          ...item,
          lots: lot
            ? {
                lot_number: lot.lot_number,
                parts: part ? { name: part.name, part_number: part.part_number } : null,
              }
            : null,
        };
      });
    case "ncrs":
      return items.map((item) => {
        const part = item.part_id ? maps.parts.get(item.part_id) : null;
        const lot = item.lot_id ? maps.lots.get(item.lot_id) : null;
        return {
          ...item,
          parts: part ? { name: part.name, part_number: part.part_number } : null,
          lots: lot ? { lot_number: lot.lot_number } : null,
          suppliers: item.supplier_id ? { name: maps.suppliers.get(item.supplier_id)?.name ?? "Unknown" } : null,
        };
      });
    case "capas":
      return items.map((item) => ({
        ...item,
        ncrs: item.ncr_id ? (() => {
          const ncr = maps.ncrs.get(item.ncr_id);
          return ncr ? { ncr_number: ncr.ncr_number, title: ncr.title } : null;
        })() : null,
      }));
    default:
      return items;
  }
}

export async function listEntity(db, entity, userId) {
  requireEntity(entity);

  const documents = await db
    .collection(entity)
    .find(entity === "device_lots" ? {} : { user_id: userId })
    .sort({ created_at: -1 })
    .toArray();

  const serialized = serializeDoc(documents);
  if (entity === "suppliers" || entity === "device_lots") {
    return serialized;
  }

  const maps = await buildMaps(db, userId);
  let serializedDeviceLots = [];

  if (entity === "devices") {
    const deviceIds = serialized.map((item) => item.id);
    const rawDeviceLots = await db
      .collection("device_lots")
      .find({ device_id: { $in: deviceIds.map((id) => new ObjectId(id)) } })
      .toArray();
    serializedDeviceLots = serializeDoc(rawDeviceLots);
  }

  return enrichEntity(entity, serialized, maps, serializedDeviceLots);
}

export async function createEntity(db, entity, userId, payload) {
  requireEntity(entity);

  const now = nowIso();
  const document = normalizeForMongo({
    ...payload,
    user_id: userId,
    created_at: now,
    updated_at: now,
  });

  const result = await db.collection(entity).insertOne(document);
  const created = await db.collection(entity).findOne({ _id: result.insertedId });
  return serializeDoc(created);
}

export async function updateEntity(db, entity, id, userId, payload) {
  requireEntity(entity);

  const updateDoc = normalizeForMongo({
    ...payload,
    updated_at: nowIso(),
  });

  delete updateDoc.id;
  delete updateDoc.user_id;
  delete updateDoc.created_at;

  await db.collection(entity).updateOne(
    {
      _id: new ObjectId(id),
      ...(entity === "device_lots" ? {} : { user_id: userId }),
    },
    { $set: updateDoc },
  );

  const updated = await db.collection(entity).findOne({
    _id: new ObjectId(id),
    ...(entity === "device_lots" ? {} : { user_id: userId }),
  });
  return serializeDoc(updated);
}

export async function deleteEntity(db, entity, id, userId) {
  requireEntity(entity);

  await db.collection(entity).deleteOne({
    _id: new ObjectId(id),
    ...(entity === "device_lots" ? {} : { user_id: userId }),
  });
}

export async function listDocuments(db, userId) {
  const [documents, suppliers, lots, ncrs] = await Promise.all([
    db.collection("documents").find({ user_id: userId }).sort({ created_at: -1 }).toArray(),
    db.collection("suppliers").find({ user_id: userId }).toArray(),
    db.collection("lots").find({ user_id: userId }).toArray(),
    db.collection("ncrs").find({ user_id: userId }).toArray(),
  ]);

  const supplierMap = new Map(suppliers.map((doc) => [doc._id.toString(), doc]));
  const lotMap = new Map(lots.map((doc) => [doc._id.toString(), doc]));
  const ncrMap = new Map(ncrs.map((doc) => [doc._id.toString(), doc]));

  return serializeDoc(documents).map((doc) => ({
    ...doc,
    suppliers: doc.linked_supplier_id ? { name: supplierMap.get(doc.linked_supplier_id)?.name ?? "Unknown" } : null,
    lots: doc.linked_lot_id ? { lot_number: lotMap.get(doc.linked_lot_id)?.lot_number ?? "Unknown" } : null,
    ncrs: doc.linked_ncr_id ? { ncr_number: ncrMap.get(doc.linked_ncr_id)?.ncr_number ?? "Unknown" } : null,
  }));
}

export async function upsertExtractedQmsData(db, { documentId, userId, extracted }) {
  const createdRecords = {};
  const documents = db.collection("documents");
  const suppliers = db.collection("suppliers");
  const parts = db.collection("parts");
  const lots = db.collection("lots");
  const inspections = db.collection("inspections");
  const ncrs = db.collection("ncrs");
  const capas = db.collection("capas");
  const now = nowIso();

  let supplierId = null;
  let partId = null;
  let lotId = null;
  let ncrId = null;
  const sourceDocumentIds = [documentId];

  if (extracted.supplier?.name) {
    const existingSupplier = await suppliers.findOne({
      user_id: userId,
      name: extracted.supplier.name,
    });

    if (existingSupplier) {
      supplierId = existingSupplier._id;
      const updateFields = normalizeForMongo({
        defect_rate: extracted.supplier.defect_rate ?? existingSupplier.defect_rate ?? 0,
        on_time_delivery: extracted.supplier.on_time_delivery ?? existingSupplier.on_time_delivery ?? 100,
        risk_level: extracted.supplier.risk_level ?? existingSupplier.risk_level ?? "medium",
        status: extracted.supplier.status ?? existingSupplier.status ?? "approved",
        certification_type: extracted.supplier.certification_type ?? existingSupplier.certification_type ?? null,
        certification_expiry: extracted.supplier.certification_expiry ?? existingSupplier.certification_expiry ?? null,
        contact_email: extracted.supplier.contact_email ?? existingSupplier.contact_email ?? null,
        contact_phone: extracted.supplier.contact_phone ?? existingSupplier.contact_phone ?? null,
        address: extracted.supplier.address ?? existingSupplier.address ?? null,
        supplier_type: extracted.supplier.supplier_type ?? existingSupplier.supplier_type ?? null,
        country: extracted.supplier.country ?? existingSupplier.country ?? null,
        audit_score: extracted.supplier.audit_score ?? existingSupplier.audit_score ?? null,
        quality_agreement_signed: extracted.supplier.quality_agreement_signed ?? existingSupplier.quality_agreement_signed ?? null,
        approved_since: extracted.supplier.approved_since ?? existingSupplier.approved_since ?? null,
        last_audit_date: extracted.supplier.last_audit_date ?? existingSupplier.last_audit_date ?? null,
        next_audit_date: extracted.supplier.next_audit_date ?? existingSupplier.next_audit_date ?? null,
        last_requalification_date: extracted.supplier.last_requalification_date ?? existingSupplier.last_requalification_date ?? null,
        requalification_due_date: extracted.supplier.requalification_due_date ?? existingSupplier.requalification_due_date ?? null,
        requalification_frequency_days: extracted.supplier.requalification_frequency_days ?? existingSupplier.requalification_frequency_days ?? null,
        certifications: extracted.supplier.certifications ?? existingSupplier.certifications ?? null,
        audit_findings: extracted.supplier.audit_findings ?? existingSupplier.audit_findings ?? null,
        source_document_ids: appendSourceDocument(existingSupplier.source_document_ids, documentId),
        updated_at: now,
      });
      await suppliers.updateOne({ _id: existingSupplier._id }, { $set: updateFields });
      createdRecords.supplier_updated = existingSupplier._id.toString();
    } else {
      const insert = await suppliers.insertOne(normalizeForMongo({
        user_id: userId,
        name: extracted.supplier.name,
        code: extracted.supplier.code || recordCode("SUP"),
        status: extracted.supplier.status || "approved",
        risk_level: extracted.supplier.risk_level || "medium",
        contact_email: extracted.supplier.contact_email || null,
        contact_phone: extracted.supplier.contact_phone || null,
        address: extracted.supplier.address || null,
        supplier_type: extracted.supplier.supplier_type || null,
        country: extracted.supplier.country || null,
        certification_type: extracted.supplier.certification_type || null,
        certification_expiry: extracted.supplier.certification_expiry || null,
        defect_rate: extracted.supplier.defect_rate ?? 0,
        on_time_delivery: extracted.supplier.on_time_delivery ?? 100,
        audit_score: extracted.supplier.audit_score ?? null,
        quality_agreement_signed: extracted.supplier.quality_agreement_signed ?? null,
        approved_since: extracted.supplier.approved_since || null,
        last_audit_date: extracted.supplier.last_audit_date || null,
        next_audit_date: extracted.supplier.next_audit_date || null,
        last_requalification_date: extracted.supplier.last_requalification_date || null,
        requalification_due_date: extracted.supplier.requalification_due_date || null,
        requalification_frequency_days: extracted.supplier.requalification_frequency_days ?? null,
        certifications: extracted.supplier.certifications || null,
        audit_findings: extracted.supplier.audit_findings || null,
        source_document_ids: sourceDocumentIds,
        created_at: now,
        updated_at: now,
      }));
      supplierId = insert.insertedId;
      createdRecords.supplier = supplierId.toString();
    }

    await documents.updateOne(
      { _id: maybeObjectId(documentId) },
      { $set: { linked_supplier_id: supplierId, updated_at: now } },
    );
  }

  if (extracted.part?.part_number) {
    const existingPart = await parts.findOne({
      user_id: userId,
      part_number: extracted.part.part_number,
    });

    if (existingPart) {
      partId = existingPart._id;
      await parts.updateOne(
        { _id: existingPart._id },
        {
          $set: normalizeForMongo({
            name: extracted.part.name || existingPart.name,
            description: extracted.part.description || existingPart.description || null,
            supplier_id: supplierId || existingPart.supplier_id || null,
            risk_class: extracted.part.risk_class || existingPart.risk_class || "II",
            fda_clearance: extracted.part.fda_clearance || existingPart.fda_clearance || null,
            unit_cost: extracted.part.unit_cost ?? existingPart.unit_cost ?? null,
            specifications: extracted.part.specifications || existingPart.specifications || null,
            material: extracted.part.material || existingPart.material || null,
            revision: extracted.part.revision || existingPart.revision || null,
            drawing_number: extracted.part.drawing_number || existingPart.drawing_number || null,
            critical_to_quality: extracted.part.critical_to_quality ?? existingPart.critical_to_quality ?? null,
            shelf_life_days: extracted.part.shelf_life_days ?? existingPart.shelf_life_days ?? null,
            sterilization_compatibility: extracted.part.sterilization_compatibility || existingPart.sterilization_compatibility || null,
            intended_use: extracted.part.intended_use || existingPart.intended_use || null,
            source_document_ids: appendSourceDocument(existingPart.source_document_ids, documentId),
            updated_at: now,
          }),
        },
      );
    } else {
      const insert = await parts.insertOne(normalizeForMongo({
        user_id: userId,
        name: extracted.part.name || extracted.part.part_number,
        part_number: extracted.part.part_number,
        description: extracted.part.description || null,
        supplier_id: supplierId,
        risk_class: extracted.part.risk_class || "II",
        fda_clearance: extracted.part.fda_clearance || null,
        unit_cost: extracted.part.unit_cost ?? null,
        specifications: extracted.part.specifications || null,
        material: extracted.part.material || null,
        revision: extracted.part.revision || null,
        drawing_number: extracted.part.drawing_number || null,
        critical_to_quality: extracted.part.critical_to_quality ?? null,
        shelf_life_days: extracted.part.shelf_life_days ?? null,
        sterilization_compatibility: extracted.part.sterilization_compatibility || null,
        intended_use: extracted.part.intended_use || null,
        source_document_ids: sourceDocumentIds,
        created_at: now,
        updated_at: now,
      }));
      partId = insert.insertedId;
      createdRecords.part = partId.toString();
    }
  }

  if (extracted.lot?.lot_number && partId) {
    const existingLot = await lots.findOne({
      user_id: userId,
      lot_number: extracted.lot.lot_number,
    });

    if (existingLot) {
      lotId = existingLot._id;
      await lots.updateOne(
        { _id: existingLot._id },
        {
          $set: normalizeForMongo({
            part_id: partId,
            supplier_id: supplierId || existingLot.supplier_id || null,
            quantity: extracted.lot.quantity ?? existingLot.quantity ?? 0,
            received_date: extracted.lot.received_date || existingLot.received_date || now.slice(0, 10),
            expiration_date: extracted.lot.expiration_date || existingLot.expiration_date || null,
            status: extracted.lot.status || existingLot.status || "quarantine",
            inspection_status: extracted.lot.inspection_status || existingLot.inspection_status || "pending",
            batch_number: extracted.lot.batch_number || existingLot.batch_number || null,
            manufacture_date: extracted.lot.manufacture_date || existingLot.manufacture_date || null,
            certificate_of_conformance: extracted.lot.certificate_of_conformance || existingLot.certificate_of_conformance || null,
            certificate_of_analysis: extracted.lot.certificate_of_analysis || existingLot.certificate_of_analysis || null,
            traceability_notes: extracted.lot.traceability_notes || existingLot.traceability_notes || null,
            serial_numbers: extracted.lot.serial_numbers || existingLot.serial_numbers || null,
            source_document_ids: appendSourceDocument(existingLot.source_document_ids, documentId),
            updated_at: now,
          }),
        },
      );
    } else {
      const insert = await lots.insertOne(normalizeForMongo({
        user_id: userId,
        part_id: partId,
        supplier_id: supplierId,
        lot_number: extracted.lot.lot_number,
        quantity: extracted.lot.quantity ?? 0,
        received_date: extracted.lot.received_date || now.slice(0, 10),
        expiration_date: extracted.lot.expiration_date || null,
        status: extracted.lot.status || "quarantine",
        inspection_status: extracted.lot.inspection_status || "pending",
        batch_number: extracted.lot.batch_number || null,
        manufacture_date: extracted.lot.manufacture_date || null,
        certificate_of_conformance: extracted.lot.certificate_of_conformance || null,
        certificate_of_analysis: extracted.lot.certificate_of_analysis || null,
        traceability_notes: extracted.lot.traceability_notes || null,
        serial_numbers: extracted.lot.serial_numbers || null,
        source_document_ids: sourceDocumentIds,
        created_at: now,
        updated_at: now,
      }));
      lotId = insert.insertedId;
      createdRecords.lot = lotId.toString();
    }

    await documents.updateOne(
      { _id: maybeObjectId(documentId) },
      { $set: { linked_lot_id: lotId, updated_at: now } },
    );
  }

  if (extracted.inspection && lotId) {
    const insert = await inspections.insertOne(normalizeForMongo({
      user_id: userId,
      lot_id: lotId,
      inspection_type: extracted.inspection.inspection_type || "incoming",
      status: extracted.inspection.status || "pending",
      inspector_name: extracted.inspection.inspector_name || null,
      inspection_date: extracted.inspection.inspection_date || now.slice(0, 10),
      sample_size: extracted.inspection.sample_size ?? null,
      defects_found: extracted.inspection.defects_found ?? 0,
      measurements: extracted.inspection.measurements || null,
      notes: extracted.inspection.notes || null,
      rejected_units: extracted.inspection.rejected_units ?? null,
      sampling_plan: extracted.inspection.sampling_plan || null,
      aql_level: extracted.inspection.aql_level || null,
      acceptance_criteria: extracted.inspection.acceptance_criteria || null,
      equipment_used: extracted.inspection.equipment_used || null,
      environmental_conditions: extracted.inspection.environmental_conditions || null,
      defect_categories: extracted.inspection.defect_categories || null,
      source_document_ids: sourceDocumentIds,
      created_at: now,
      updated_at: now,
    }));
    createdRecords.inspection = insert.insertedId.toString();
  }

  if (extracted.ncr?.title) {
    const insert = await ncrs.insertOne(normalizeForMongo({
      user_id: userId,
      ncr_number: recordCode("NCR"),
      title: extracted.ncr.title,
      description: extracted.ncr.description || null,
      lot_id: lotId,
      part_id: partId,
      supplier_id: supplierId,
      severity: extracted.ncr.severity || "minor",
      status: "open",
      disposition: extracted.ncr.disposition || null,
      disposition_reason: extracted.ncr.disposition_reason || null,
      root_cause: extracted.ncr.root_cause || null,
      corrective_action: extracted.ncr.corrective_action || null,
      detected_date: extracted.ncr.detected_date || null,
      detection_source: extracted.ncr.detection_source || null,
      containment_action: extracted.ncr.containment_action || null,
      impact_assessment: extracted.ncr.impact_assessment || null,
      affected_quantity: extracted.ncr.affected_quantity ?? null,
      source_document_ids: sourceDocumentIds,
      created_at: now,
      updated_at: now,
    }));
    ncrId = insert.insertedId;
    createdRecords.ncr = ncrId.toString();

    await documents.updateOne(
      { _id: maybeObjectId(documentId) },
      { $set: { linked_ncr_id: ncrId, updated_at: now } },
    );
  }

  if (extracted.capa?.title) {
    const insert = await capas.insertOne(normalizeForMongo({
      user_id: userId,
      ncr_id: ncrId,
      capa_number: recordCode("CAPA"),
      title: extracted.capa.title,
      description: extracted.capa.description || null,
      type: extracted.capa.type || "corrective",
      status: "open",
      priority: extracted.capa.priority || "medium",
      root_cause: extracted.capa.root_cause || null,
      action_plan: extracted.capa.action_plan || null,
      assigned_to: extracted.capa.assigned_to || null,
      due_date: extracted.capa.due_date || null,
      effectiveness_check: extracted.capa.effectiveness_check || null,
      trigger_reason: extracted.capa.trigger_reason || null,
      verification_method: extracted.capa.verification_method || null,
      effectiveness_due_date: extracted.capa.effectiveness_due_date || null,
      recurrence_risk: extracted.capa.recurrence_risk || null,
      source_document_ids: sourceDocumentIds,
      created_at: now,
      updated_at: now,
    }));
    createdRecords.capa = insert.insertedId.toString();
  }

  return createdRecords;
}
