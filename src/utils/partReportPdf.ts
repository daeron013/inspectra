import jsPDF from "jspdf";

interface PartReportData {
  part: Record<string, any>;
  supplier: Record<string, any> | null;
  lots: Record<string, any>[];
  inspections: Record<string, any>[];
  ncrs: Record<string, any>[];
  capas: Record<string, any>[];
}

export function generatePartComplianceReport(data: PartReportData) {
  const { part, supplier, lots, inspections, ncrs, capas } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };
  const checkPage = (needed: number) => { if (y + needed > 270) addPage(); };

  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  const sectionTitle = (title: string) => {
    checkPage(20);
    y += 4;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(title, margin, y);
    y += 2;
    drawLine();
    y += 2;
  };

  const labelValue = (label: string, value: string, xOffset = 0) => {
    checkPage(10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(label, margin + xOffset, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    doc.text(value || "—", margin + xOffset + 45, y);
    y += 6;
  };

  const tableHeader = (cols: { label: string; x: number }[]) => {
    checkPage(14);
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, y - 4, contentWidth, 8, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80, 80, 80);
    cols.forEach(c => doc.text(c.label, c.x, y));
    y += 8;
  };

  const tableRow = (cols: { text: string; x: number }[]) => {
    checkPage(10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30, 30, 30);
    cols.forEach(c => doc.text(String(c.text ?? "—"), c.x, y));
    y += 6;
  };

  // ─── Header ───────────────────────────────────────────
  doc.setFillColor(20, 30, 50);
  doc.rect(0, 0, pageWidth, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Part Compliance Report", margin, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, margin, 28);
  doc.text(`Part: ${part.part_number} — ${part.name}`, margin, 35);
  y = 50;

  // ─── Part Details ─────────────────────────────────────
  sectionTitle("Part Information");
  labelValue("Part Number:", part.part_number);
  labelValue("Name:", part.name);
  labelValue("Description:", part.description || "—");
  labelValue("Risk Class:", `Class ${part.risk_class || "II"}`);
  labelValue("FDA Clearance:", part.fda_clearance || "None");
  labelValue("Unit Cost:", part.unit_cost ? `$${Number(part.unit_cost).toFixed(2)}` : "—");

  // ─── Supplier Details ─────────────────────────────────
  sectionTitle("Supplier Information");
  if (supplier) {
    labelValue("Supplier:", supplier.name);
    labelValue("Code:", supplier.code);
    labelValue("Status:", supplier.status?.toUpperCase());
    labelValue("Risk Level:", supplier.risk_level?.toUpperCase());
    labelValue("Defect Rate:", `${supplier.defect_rate ?? 0}%`);
    labelValue("On-Time Delivery:", `${supplier.on_time_delivery ?? 100}%`);
    labelValue("Certification:", supplier.certification_type || "—");
    labelValue("Cert Expiry:", supplier.certification_expiry || "—");
    labelValue("Contact Email:", supplier.contact_email || "—");
    labelValue("Contact Phone:", supplier.contact_phone || "—");
    labelValue("Address:", supplier.address || "—");
    labelValue("Last Audit:", supplier.last_audit_date || "—");
    labelValue("Next Audit:", supplier.next_audit_date || "—");

    // Compliance flags
    const flags: string[] = [];
    if (supplier.status === "disqualified") flags.push("⚠ Supplier is DISQUALIFIED");
    if (supplier.certification_expiry && new Date(supplier.certification_expiry) < new Date()) flags.push("⚠ Certification EXPIRED");
    if (Number(supplier.defect_rate) > 2) flags.push("⚠ Defect rate exceeds 2% threshold");
    if (supplier.risk_level === "critical" || supplier.risk_level === "high") flags.push(`⚠ Risk level: ${supplier.risk_level.toUpperCase()}`);

    if (flags.length > 0) {
      checkPage(10 + flags.length * 7);
      y += 2;
      doc.setFillColor(255, 240, 240);
      doc.rect(margin, y - 4, contentWidth, 8 + flags.length * 7, "F");
      doc.setDrawColor(220, 100, 100);
      doc.rect(margin, y - 4, contentWidth, 8 + flags.length * 7, "S");
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 40, 40);
      doc.text("COMPLIANCE ALERTS", margin + 4, y + 2);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      flags.forEach(f => { doc.text(f, margin + 6, y); y += 7; });
      y += 4;
    }
  } else {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.text("No supplier assigned to this part.", margin, y);
    y += 8;
  }

  // ─── Lot History ──────────────────────────────────────
  sectionTitle(`Lot History (${lots.length})`);
  if (lots.length > 0) {
    tableHeader([
      { label: "Lot #", x: margin },
      { label: "Status", x: margin + 35 },
      { label: "Qty", x: margin + 65 },
      { label: "Received", x: margin + 85 },
      { label: "Expiration", x: margin + 115 },
    ]);
    lots.forEach(l => tableRow([
      { text: l.lot_number, x: margin },
      { text: l.status, x: margin + 35 },
      { text: String(l.quantity), x: margin + 65 },
      { text: l.received_date, x: margin + 85 },
      { text: l.expiration_date || "N/A", x: margin + 115 },
    ]));
  } else {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text("No lots recorded.", margin, y); y += 8;
  }

  // ─── Inspections ──────────────────────────────────────
  sectionTitle(`Inspections (${inspections.length})`);
  if (inspections.length > 0) {
    tableHeader([
      { label: "Date", x: margin },
      { label: "Type", x: margin + 30 },
      { label: "Status", x: margin + 60 },
      { label: "Sample", x: margin + 90 },
      { label: "Defects", x: margin + 115 },
      { label: "Inspector", x: margin + 135 },
    ]);
    inspections.forEach(i => tableRow([
      { text: i.inspection_date, x: margin },
      { text: i.inspection_type, x: margin + 30 },
      { text: i.status, x: margin + 60 },
      { text: String(i.sample_size ?? "—"), x: margin + 90 },
      { text: String(i.defects_found ?? 0), x: margin + 115 },
      { text: i.inspector_name || "—", x: margin + 135 },
    ]));
  } else {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text("No inspections recorded.", margin, y); y += 8;
  }

  // ─── NCRs ─────────────────────────────────────────────
  sectionTitle(`Nonconformance Reports (${ncrs.length})`);
  if (ncrs.length > 0) {
    tableHeader([
      { label: "NCR #", x: margin },
      { label: "Title", x: margin + 30 },
      { label: "Severity", x: margin + 90 },
      { label: "Status", x: margin + 120 },
    ]);
    ncrs.forEach(n => tableRow([
      { text: n.ncr_number, x: margin },
      { text: (n.title || "").substring(0, 30), x: margin + 30 },
      { text: n.severity, x: margin + 90 },
      { text: n.status, x: margin + 120 },
    ]));
  } else {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text("No nonconformances recorded.", margin, y); y += 8;
  }

  // ─── CAPAs ────────────────────────────────────────────
  sectionTitle(`CAPAs (${capas.length})`);
  if (capas.length > 0) {
    tableHeader([
      { label: "CAPA #", x: margin },
      { label: "Title", x: margin + 30 },
      { label: "Type", x: margin + 90 },
      { label: "Status", x: margin + 120 },
      { label: "Priority", x: margin + 150 },
    ]);
    capas.forEach(c => tableRow([
      { text: c.capa_number, x: margin },
      { text: (c.title || "").substring(0, 30), x: margin + 30 },
      { text: c.type, x: margin + 90 },
      { text: c.status, x: margin + 120 },
      { text: c.priority, x: margin + 150 },
    ]));
  } else {
    doc.setFontSize(9); doc.setTextColor(150, 150, 150);
    doc.text("No CAPAs recorded.", margin, y); y += 8;
  }

  // ─── Footer on all pages ──────────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.setFont("helvetica", "normal");
    doc.text(`Inspectra QMS — Part Compliance Report — Page ${i} of ${totalPages}`, margin, 288);
    doc.text("CONFIDENTIAL — For internal quality management use only", pageWidth - margin, 288, { align: "right" });
  }

  doc.save(`Part_${part.part_number}_Compliance_Report.pdf`);
}
