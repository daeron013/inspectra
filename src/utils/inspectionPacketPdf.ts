import jsPDF from "jspdf";

interface SupplierInspectionPacketInput {
  supplier: Record<string, any>;
  parts: Record<string, any>[];
}

function addWrappedLine(doc: jsPDF, text: string, x: number, y: number, width: number) {
  const lines = doc.splitTextToSize(text || "—", width);
  doc.text(lines, x, y);
  return y + lines.length * 4.5;
}

export function generateSupplierInspectionPacketPdf({ supplier, parts }: SupplierInspectionPacketInput) {
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

  const section = (title: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(25, 25, 25);
    doc.text(title, margin, y);
    y += 3;
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  const field = (label: string, value: string) => {
    ensureSpace(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(35, 35, 35);
    y = addWrappedLine(doc, value || "—", margin + 48, y, contentWidth - 48) + 2;
  };

  doc.setFillColor(23, 34, 54);
  doc.rect(0, 0, pageWidth, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Supplier Inspection Packet", margin, 10);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("ISO 13485-aligned supplier oversight packet", margin, 17);
  doc.text(new Date().toLocaleString(), pageWidth - margin, 17, { align: "right" });
  y = 33;
  doc.setTextColor(30, 30, 30);

  section("Supplier Identification");
  field("Supplier", supplier.name || "—");
  field("Status / Risk", `${supplier.status || "—"} / ${supplier.risk_level || "—"}`);
  field("Type", supplier.supplier_type || "—");
  field("Address", supplier.address || "—");
  field("Quality Contact", [supplier.contact_email, supplier.contact_phone].filter(Boolean).join(" · ") || "—");

  section("Qualification and Control");
  field("Certification", supplier.certification_type || "—");
  field("Certification Expiry", supplier.certification_expiry || "—");
  field("Audit Score", supplier.audit_score ? String(supplier.audit_score) : "—");
  field("Last Audit / Next Audit", `${supplier.last_audit_date || "—"} / ${supplier.next_audit_date || "—"}`);
  field("Requalification Due", supplier.requalification_due_date || "—");
  field("Quality Agreement", supplier.quality_agreement_signed ? "Signed and on file" : "Not confirmed");

  section("Supplied Parts");
  const suppliedParts = parts.length
    ? parts.map((part) => `${part.part_number || "—"} — ${part.name || "Unnamed part"}${part.drawing_number ? ` (${part.drawing_number})` : ""}`)
    : ["No linked parts in current workspace."];
  suppliedParts.forEach((line) => {
    ensureSpace(6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    y = addWrappedLine(doc, `• ${line}`, margin, y, contentWidth) + 1;
  });

  section("Inspection Readiness Notes");
  field(
    "ISO 13485 Focus",
    "This packet supports supplier control, qualification, requalification, and external-provider oversight under ISO 13485 purchasing and monitoring requirements."
  );
  field(
    "Expected Evidence",
    "Pair this packet with current supplier certificates, quality agreements, audit reports, incoming inspection records, and linked NCR/CAPA records during inspection."
  );
  field(
    "Control Note",
    "This packet is generated from the current QMS workspace and should be filed with controlled source records for inspection readiness."
  );

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140, 140, 140);
    doc.text(`Inspectra QMS — Supplier Inspection Packet — Page ${page} of ${pageCount}`, margin, 288);
  }

  const safeName = String(supplier.name || "supplier").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`supplier-inspection-packet-${safeName}.pdf`);
}
