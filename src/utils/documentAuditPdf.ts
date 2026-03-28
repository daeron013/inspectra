import jsPDF from "jspdf";

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function generateDocumentAuditPdf(document: Record<string, any>) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const extracted = document.extracted_data || {};
  const compliance = document.compliance_signals || extracted.compliance || {};
  const traceability = document.traceability_map || extracted.traceability || {};

  const ensureSpace = (needed = 12) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  const section = (title: string) => {
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(title, margin, y);
    y += 3;
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const field = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(90, 90, 90);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(35, 35, 35);
    y = addWrappedText(doc, value || "—", margin + 42, y, contentWidth - 42, 4.5);
    y += 1.5;
  };

  const bulletList = (items: string[]) => {
    const values = items.length ? items : ["—"];
    values.forEach((item) => {
      ensureSpace(6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(35, 35, 35);
      y = addWrappedText(doc, `• ${item}`, margin + 2, y, contentWidth - 2, 4.5);
      y += 1;
    });
  };

  doc.setFillColor(22, 34, 54);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Inspectra Audit Packet", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`${document.title || document.file_name || "Document"}`, margin, 17);
  doc.text(new Date().toLocaleString(), pageWidth - margin, 17, { align: "right" });
  y = 32;

  section("Document Control");
  field("Title", document.title || extracted.document_control?.title || "—");
  field("Document Type", document.document_type || extracted.document_type || "—");
  field("Document Number", document.document_number || extracted.document_control?.document_number || "—");
  field("Version / Revision", `${document.version || "1.0"} / ${document.revision || extracted.document_control?.revision || "—"}`);
  field("Effective Date", document.effective_date || extracted.document_control?.effective_date || "—");
  field("Approval Date", document.approval_date || extracted.document_control?.approval_date || "—");
  field("Owner", document.document_owner || extracted.document_control?.document_owner || "—");
  field("Approvers", (document.approvers || extracted.document_control?.approvers || []).join(", ") || "—");
  field("Summary", document.notes || extracted.summary || "—");

  section("Supplier Qualification");
  field("Supplier", extracted.supplier?.name || "—");
  field("Supplier Status", extracted.supplier?.status || "—");
  field("Risk Level", extracted.supplier?.risk_level || "—");
  field("Certification", extracted.supplier?.certification_type || "—");
  field("Certification Expiry", extracted.supplier?.certification_expiry || "—");
  field("Last Audit / Next Audit", `${extracted.supplier?.last_audit_date || "—"} / ${extracted.supplier?.next_audit_date || "—"}`);
  field("Requalification Due", extracted.supplier?.requalification_due_date || "—");

  section("Traceability");
  field("Part / Drawing", `${extracted.part?.part_number || "—"} / ${extracted.part?.drawing_number || "—"}`);
  field("Lot / Batch", `${extracted.lot?.lot_number || "—"} / ${extracted.lot?.batch_number || traceability.supplier_batch || "—"}`);
  field("Receiving Record", traceability.receiving_record || "—");
  field("CoC / CoA", `${extracted.lot?.certificate_of_conformance || "—"} / ${extracted.lot?.certificate_of_analysis || "—"}`);
  field("Finished Devices", (traceability.finished_device_ids || []).join(", ") || "—");
  field("Affected Products", (traceability.affected_products || []).join(", ") || "—");

  section("Inspection Evidence");
  field("Inspection Type", extracted.inspection?.inspection_type || "—");
  field("Inspector", extracted.inspection?.inspector_name || "—");
  field("Sampling / AQL", `${extracted.inspection?.sampling_plan || "—"} / ${extracted.inspection?.aql_level || "—"}`);
  field("Sample / Defects / Rejected", `${extracted.inspection?.sample_size ?? "—"} / ${extracted.inspection?.defects_found ?? "—"} / ${extracted.inspection?.rejected_units ?? "—"}`);
  field("Acceptance Criteria", extracted.inspection?.acceptance_criteria || "—");

  section("Nonconformance and CAPA");
  field("NCR", extracted.ncr?.title || "—");
  field("Disposition", extracted.ncr?.disposition || "—");
  field("Root Cause", extracted.ncr?.root_cause || extracted.capa?.root_cause || "—");
  field("Containment", extracted.ncr?.containment_action || "—");
  field("CAPA", extracted.capa?.title || "—");
  field("Action Plan", extracted.capa?.action_plan || "—");
  field("Effectiveness Check", extracted.capa?.effectiveness_check || "—");

  section("Compliance Signals");
  field("ISO 13485 Clauses", (compliance.iso_13485_clauses || []).join(", ") || "—");
  field("FDA 21 CFR 820 Sections", (compliance.fda_21_cfr_820_sections || []).join(", ") || "—");
  field("Requires Requalification", compliance.requires_requalification ? "Yes" : "No");
  field("Requires Supplier Audit", compliance.requires_supplier_audit ? "Yes" : "No");

  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Audit Readiness Flags", margin, y);
  y += 6;
  bulletList(compliance.audit_readiness_flags || []);

  ensureSpace(10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Missing Records", margin, y);
  y += 6;
  bulletList(compliance.missing_records || []);

  doc.save(`${(document.document_number || document.title || "audit-packet").replace(/\s+/g, "-").toLowerCase()}.pdf`);
}
