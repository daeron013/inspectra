import jsPDF from "jspdf";

type RecordLike = Record<string, any>;

interface ComplianceDocumentData {
  suppliers: RecordLike[];
  parts: RecordLike[];
  lots: RecordLike[];
  inspections: RecordLike[];
  ncrs: RecordLike[];
  capas: RecordLike[];
}

function createDoc(title: string, subtitle: string) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const ensureSpace = (needed = 10) => {
    if (y + needed > pageHeight - 15) {
      doc.addPage();
      y = 18;
    }
  };

  const line = () => {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  const section = (heading: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(heading, margin, y);
    y += 3;
    line();
  };

  const textBlock = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(35, 35, 35);
    const lines = doc.splitTextToSize(value || "—", contentWidth - 45);
    doc.text(lines, margin + 45, y);
    y += Math.max(6, lines.length * 4.5);
  };

  const row = (values: string[], widths: number[]) => {
    ensureSpace(7);
    let x = margin;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    values.forEach((value, index) => {
      const lines = doc.splitTextToSize(value || "—", widths[index] - 2);
      doc.text(lines, x, y);
      x += widths[index];
    });
    y += 6;
  };

  const headerRow = (values: string[], widths: number[]) => {
    ensureSpace(8);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, contentWidth, 7, "F");
    let x = margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    values.forEach((value, index) => {
      doc.text(value, x, y);
      x += widths[index];
    });
    y += 6;
  };

  doc.setFillColor(23, 34, 54);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, margin, 17);
  doc.text(new Date().toLocaleString(), pageWidth - margin, 17, { align: "right" });
  y = 33;

  section("Document Control");
  textBlock("Standard", "ISO 13485 aligned quality-management document draft for medical-device inspection readiness.");
  textBlock("Document Status", "Controlled draft generated from live Inspectra QMS data. Final review and approval by the company's designated quality authority is required before external use.");
  textBlock("Intended Use", "Support FDA and ISO 13485 inspection readiness, internal audit preparation, and controlled document compilation.");

  return { doc, margin, contentWidth, pageWidth, ensureSpace, section, textBlock, row, headerRow, getY: () => y, setY: (next: number) => { y = next; } };
}

function addFooter(doc: jsPDF, name: string) {
  const totalPages = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let i = 1; i <= totalPages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Inspectra QMS — ${name} — Page ${i} of ${totalPages}`, 15, 288);
    doc.text("Controlled draft — QA approval required before official release", pageWidth - 15, 288, { align: "right" });
  }
}

export function generateApprovedSupplierListPdf(data: ComplianceDocumentData) {
  const { doc, section, textBlock, headerRow, row } = createDoc("Approved Supplier List", "ASL / supplier qualification register");

  const approved = data.suppliers.filter((supplier) => supplier.status === "approved" || supplier.status === "conditional");
  section("Supplier Register");
  textBlock("Scope", `Total suppliers in system: ${data.suppliers.length}. Qualified suppliers in this register: ${approved.length}.`);
  headerRow(["Code", "Supplier", "Status", "Risk", "Certification", "Requal Due"], [22, 48, 24, 22, 38, 26]);
  approved.forEach((supplier) =>
    row(
      [
        supplier.code || "—",
        supplier.name || "—",
        supplier.status || "—",
        supplier.risk_level || "—",
        supplier.certification_type || "—",
        supplier.requalification_due_date || "—",
      ],
      [22, 48, 24, 22, 38, 26],
    ),
  );

  section("Release Notes");
  textBlock("Use During Inspection", "Provide this register as the current approved supplier list and pair it with supplier qualification records, audit evidence, and supporting certificates where requested.");
  addFooter(doc, "Approved Supplier List");
  doc.save("approved-supplier-list.pdf");
}

export function generateRequalificationPlanPdf(data: ComplianceDocumentData) {
  const { doc, section, textBlock, headerRow, row } = createDoc("Supplier Requalification Plan", "Periodic review and audit schedule");

  const scheduled = [...data.suppliers].sort((a, b) =>
    String(a.requalification_due_date || "9999-99-99").localeCompare(String(b.requalification_due_date || "9999-99-99")),
  );

  section("Requalification Schedule");
  textBlock("Purpose", "Track suppliers requiring periodic review, audit refresh, certificate renewal, or risk-based requalification.");
  headerRow(["Supplier", "Risk", "Last Audit", "Next Audit", "Requal Due", "Cadence"], [48, 20, 28, 28, 28, 28]);
  scheduled.forEach((supplier) =>
    row(
      [
        supplier.name || "—",
        supplier.risk_level || "—",
        supplier.last_audit_date || "—",
        supplier.next_audit_date || "—",
        supplier.requalification_due_date || "—",
        supplier.requalification_frequency_days ? `${supplier.requalification_frequency_days}d` : "—",
      ],
      [48, 20, 28, 28, 28, 28],
    ),
  );

  addFooter(doc, "Supplier Requalification Plan");
  doc.save("supplier-requalification-plan.pdf");
}

export function generateIncomingInspectionPacketPdf(data: ComplianceDocumentData) {
  const { doc, section, textBlock, headerRow, row } = createDoc("Incoming Inspection Packet", "ISO 13485-aligned receiving inspection evidence");

  const pendingLots = data.lots.filter((lot) => lot.inspection_status !== "passed");
  const recentInspections = [...data.inspections]
    .sort((a, b) => String(b.inspection_date || "").localeCompare(String(a.inspection_date || "")))
    .slice(0, 20);

  section("Pending Receiving Review");
  textBlock("Queue Size", `${pendingLots.length} lots currently require inspection completion, review, or disposition.`);
  textBlock("ISO 13485 Focus", "Supports incoming product verification, acceptance activities, traceability, and nonconformance escalation for externally provided product.");
  headerRow(["Lot", "Part", "Supplier", "Qty", "Received", "Inspection"], [26, 44, 44, 16, 28, 32]);
  pendingLots.forEach((lot) =>
    row(
      [
        lot.lot_number || "—",
        lot.parts?.part_number || lot.parts?.name || "—",
        lot.suppliers?.name || "—",
        String(lot.quantity ?? "—"),
        lot.received_date || "—",
        lot.inspection_status || "—",
      ],
      [26, 44, 44, 16, 28, 32],
    ),
  );

  section("Recent Inspection Evidence");
  headerRow(["Date", "Lot", "Type", "Status", "Sample", "Defects"], [24, 30, 34, 28, 20, 24]);
  recentInspections.forEach((inspection) =>
    row(
      [
        inspection.inspection_date || "—",
        inspection.lots?.lot_number || "—",
        inspection.inspection_type || "—",
        inspection.status || "—",
        String(inspection.sample_size ?? "—"),
        String(inspection.defects_found ?? "—"),
      ],
      [24, 30, 34, 28, 20, 24],
    ),
  );

  section("Required Controlled Evidence");
  textBlock("Inspection Packet Contents", "Pair this packet with source receiving records, lot and batch identifiers, certificates of conformance/analysis, applicable specifications, and linked NCR/CAPA records where failures occurred.");
  textBlock("Inspection Note", "Use this packet as a controlled draft summary for inspection readiness. Final release and inclusion in an official inspection binder should follow your internal document-control process.");

  addFooter(doc, "Incoming Inspection Packet");
  doc.save("incoming-inspection-packet.pdf");
}

export function generateNcrCapaRegisterPdf(data: ComplianceDocumentData) {
  const { doc, section, textBlock, headerRow, row } = createDoc("NCR and CAPA Register", "Nonconformance and corrective/preventive action summary");

  section("Nonconformance Register");
  textBlock("Open NCRs", `${data.ncrs.filter((ncr) => ncr.status !== "closed").length} NCRs remain open or under investigation.`);
  headerRow(["NCR #", "Title", "Severity", "Status", "Disposition"], [24, 70, 24, 24, 38]);
  data.ncrs.forEach((ncr) =>
    row(
      [
        ncr.ncr_number || "—",
        ncr.title || "—",
        ncr.severity || "—",
        ncr.status || "—",
        ncr.disposition || "pending",
      ],
      [24, 70, 24, 24, 38],
    ),
  );

  section("CAPA Register");
  textBlock("Open CAPAs", `${data.capas.filter((capa) => capa.status !== "closed").length} CAPAs remain open or in progress.`);
  headerRow(["CAPA #", "Title", "Priority", "Status", "Due Date"], [24, 70, 24, 24, 38]);
  data.capas.forEach((capa) =>
    row(
      [
        capa.capa_number || "—",
        capa.title || "—",
        capa.priority || "—",
        capa.status || "—",
        capa.due_date || "—",
      ],
      [24, 70, 24, 24, 38],
    ),
  );

  addFooter(doc, "NCR and CAPA Register");
  doc.save("ncr-capa-register.pdf");
}

export function generateManagementReviewPdf(data: ComplianceDocumentData) {
  const { doc, section, textBlock } = createDoc("Management Review Summary", "QMS performance summary for leadership review");

  const overdueSupplierActions = data.suppliers.filter(
    (supplier) => supplier.requalification_due_date && new Date(supplier.requalification_due_date) < new Date(),
  ).length;

  section("QMS Summary");
  textBlock("Suppliers", `${data.suppliers.length} suppliers tracked, ${data.suppliers.filter((s) => s.status === "approved").length} approved, ${overdueSupplierActions} overdue for requalification.`);
  textBlock("Parts and Lots", `${data.parts.length} parts and ${data.lots.length} lots under control. ${data.lots.filter((lot) => lot.inspection_status !== "passed").length} lots still require inspection follow-up.`);
  textBlock("Nonconformance", `${data.ncrs.length} NCRs logged, ${data.ncrs.filter((ncr) => ncr.status !== "closed").length} not yet closed.`);
  textBlock("Corrective Action", `${data.capas.length} CAPAs tracked, ${data.capas.filter((capa) => capa.status !== "closed").length} not yet closed.`);

  section("Inspection Readiness Notes");
  textBlock("ISO 13485 Alignment", "Use this review summary to support management-review evidence, supplier oversight, CAPA follow-up, inspection trends, and risk-based quality planning.");
  textBlock("Final Approval", "Before external use, route this summary through document control, assign an official document number/revision, and capture approver signatures per your internal SOP.");

  addFooter(doc, "Management Review Summary");
  doc.save("management-review-summary.pdf");
}
