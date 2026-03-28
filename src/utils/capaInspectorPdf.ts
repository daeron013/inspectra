import jsPDF from "jspdf";

export interface CapaInspectorPdfInput {
  capas: Record<string, any>[];
  ncrs: Record<string, any>[];
  generatedAt?: Date;
}

/**
 * Inspector-facing PDF: open CAPAs, linked NCR context, and key fields for audits / supplier visits.
 */
export function generateCapaInspectorPackagePdf(data: CapaInspectorPdfInput) {
  const { capas, ncrs, generatedAt = new Date() } = data;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  const addPage = () => {
    doc.addPage();
    y = 18;
  };
  const check = (h: number) => {
    if (y + h > 278) addPage();
  };

  const ncrById = new Map(ncrs.map((n) => [n.id, n]));

  doc.setFillColor(22, 40, 58);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("CAPA Inspector Package", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${generatedAt.toLocaleString()}`, margin, 24);
  doc.text("Inspectra QMS — for field / audit use", pageWidth - margin, 24, { align: "right" });
  y = 44;
  doc.setTextColor(30, 30, 30);

  const openCapas = capas.filter((c) => c.status !== "closed");
  const section = (title: string) => {
    check(14);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
  };

  section(`Open & in-progress CAPAs (${openCapas.length})`);
  if (openCapas.length === 0) {
    check(8);
    doc.setTextColor(100, 100, 100);
    doc.text("No open CAPAs.", margin, y);
    y += 8;
    doc.setTextColor(30, 30, 30);
  } else {
    for (const c of openCapas) {
      check(42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`${c.capa_number || "—"} — ${c.title || ""}`, margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const lines = [
        `Status: ${c.status || "—"}  |  Priority: ${c.priority || "—"}  |  Type: ${c.type || "—"}`,
        `Owner: ${c.assigned_to || "—"}  |  Due: ${c.due_date || "—"}`,
        `Root cause: ${(c.root_cause || "—").slice(0, 200)}${(c.root_cause || "").length > 200 ? "…" : ""}`,
        `Action plan: ${(c.action_plan || "—").slice(0, 200)}${(c.action_plan || "").length > 200 ? "…" : ""}`,
      ];
      const ncrRef = (c as any).ncrs?.ncr_number || "";
      if (ncrRef) lines.push(`Linked NCR: ${ncrRef}`);
      if (c.linked_ncr_ids?.length) {
        lines.push(`Linked NCR ids: ${c.linked_ncr_ids.slice(0, 5).join(", ")}`);
      }
      for (const line of lines) {
        check(6);
        const wrapped = doc.splitTextToSize(line, contentWidth);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4 + 1;
      }
      y += 4;
    }
  }

  section("Supporting NCR context (recent)");
  const recentNcrs = ncrs.slice(0, 25);
  check(10);
  doc.setFontSize(8);
  for (const n of recentNcrs) {
    check(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${n.ncr_number || n.id} — ${(n.title || "").slice(0, 60)}`, margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    const detail = doc.splitTextToSize(
      `Severity: ${n.severity || "—"}  Status: ${n.status || "—"}  ${n.description ? n.description.slice(0, 120) + (n.description.length > 120 ? "…" : "") : ""}`,
      contentWidth,
    );
    doc.text(detail, margin, y);
    y += detail.length * 3.5 + 3;
  }

  section("NCR ↔ CAPA traceability (quick lookup)");
  check(8);
  doc.setFontSize(7);
  for (const c of capas.slice(0, 40)) {
    const primary = c.ncr_id ? ncrById.get(c.ncr_id) : null;
    check(5);
    doc.text(
      `${c.capa_number}: ${primary?.ncr_number || "—"}  ${c.title?.slice(0, 40) || ""}`,
      margin,
      y,
    );
    y += 4;
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`Page ${i} of ${pageCount} — CAPA Inspector Package`, margin, 292);
  }

  doc.save(`CAPA-inspector-package-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}
