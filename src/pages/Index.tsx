import { useMemo } from "react";
import { PageLayout } from "@/components/PageLayout";
import { PriorityList, type DashboardPriorityItem } from "@/components/PriorityList";
import { ComplianceChart } from "@/components/ComplianceChart";
<<<<<<< HEAD
import { priorityItems } from "@/data/mockData";

const Dashboard = () => {
=======
import { useAuth } from "@/hooks/useAuth";
import { useCAPAs, useComplianceAgentItems, useInspections, useLots, useNCRs, useSuppliers } from "@/hooks/useQMS";

function formatRelativeDate(dateString?: string) {
  if (!dateString) return "recently";
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return "recently";
  const diffDays = Math.round((Date.now() - target.getTime()) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

function riskFromPriorityTier(priorityTier?: string): DashboardPriorityItem["risk"] {
  switch (priorityTier) {
    case "P0":
      return "critical";
    case "P1":
      return "high";
    case "P2":
      return "medium";
    default:
      return "low";
  }
}

const Dashboard = () => {
  const { user } = useAuth();
  const organizationName = user?.organizationName;
  const { data: suppliers = [] } = useSuppliers();
  const { data: lots = [] } = useLots();
  const { data: inspections = [] } = useInspections();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const { data: complianceRiskItems = [] } = useComplianceAgentItems(8);

  const priorityItems = useMemo<DashboardPriorityItem[]>(() => {
    const supplierMap = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const lotMap = new Map(lots.map((lot) => [lot.id, lot]));
    const items: Array<DashboardPriorityItem & { score: number }> = [];

    for (const riskItem of complianceRiskItems) {
      const risk = riskFromPriorityTier(riskItem.priority_tier);
      items.push({
        id: `compliance-${riskItem.id}`,
        title: riskItem.title || "Compliance risk identified",
        description: riskItem.reasoning || "Compliance Agent flagged a regulatory risk requiring review.",
        risk,
        agent: "Compliance Agent",
        timestamp: formatRelativeDate(riskItem.created_at),
        type: "compliance",
        score: risk === "critical" ? 100 : risk === "high" ? 85 : risk === "medium" ? 70 : 55,
      });
    }

    for (const supplier of suppliers) {
      const daysToRequalify = supplier.requalification_due_date
        ? Math.ceil((new Date(supplier.requalification_due_date).getTime() - Date.now()) / 86400000)
        : null;
      const expiredCert = supplier.certification_expiry
        ? new Date(supplier.certification_expiry).getTime() < Date.now()
        : false;

      if (daysToRequalify !== null && daysToRequalify <= 30) {
        const risk: DashboardPriorityItem["risk"] = daysToRequalify < 0 || expiredCert ? "critical" : "high";
        items.push({
          id: `supplier-${supplier.id}`,
          title: `${daysToRequalify < 0 ? "Requalify" : "Review"} ${supplier.name}`,
          description:
            `${supplier.name} is ${daysToRequalify < 0 ? `${Math.abs(daysToRequalify)} days overdue` : `due in ${daysToRequalify} days`} for requalification.` +
            (expiredCert ? " Supplier certification is expired." : ""),
          risk,
          agent: "Supplier Agent",
          timestamp: formatRelativeDate(supplier.updated_at || supplier.requalification_due_date),
          type: "supplier",
          score: risk === "critical" ? 92 : 76,
        });
      }
    }

    for (const inspection of inspections.filter((entry) => entry.status === "failed")) {
      const lot = lotMap.get(inspection.lot_id);
      const supplier = supplierMap.get(inspection.supplier_id);
      items.push({
        id: `inspection-${inspection.id}`,
        title: `Failed inspection${lot?.lot_number ? ` — ${lot.lot_number}` : ""}`,
        description:
          `${inspection.defects_found ?? 0} defects found${inspection.rejected_units ? `, ${inspection.rejected_units} units rejected` : ""}` +
          `${supplier?.name ? ` from ${supplier.name}` : ""}.`,
        risk: inspection.rejected_units > 0 ? "critical" : "high",
        agent: "Inspection Agent",
        timestamp: formatRelativeDate(inspection.updated_at || inspection.created_at),
        type: "inspection",
        score: inspection.rejected_units > 0 ? 95 : 80,
      });
    }

    for (const ncr of ncrs.filter((entry) => entry.status !== "closed")) {
      const lot = lotMap.get(ncr.lot_id);
      items.push({
        id: `ncr-${ncr.id}`,
        title: ncr.ncr_number ? `${ncr.ncr_number} — ${ncr.title || "Open NCR"}` : ncr.title || "Open NCR",
        description:
          `${ncr.disposition ? `Disposition: ${ncr.disposition}. ` : ""}` +
          `${lot?.lot_number ? `Linked lot ${lot.lot_number}. ` : ""}` +
          `${ncr.root_cause ? `Root cause: ${ncr.root_cause}.` : "Disposition and closure still pending."}`,
        risk: ncr.severity === "critical" ? "critical" : ncr.severity === "major" ? "high" : "medium",
        agent: "NCR Workflow",
        timestamp: formatRelativeDate(ncr.updated_at || ncr.created_at),
        type: "ncr",
        score: ncr.severity === "critical" ? 93 : ncr.severity === "major" ? 82 : 68,
      });
    }

    for (const capa of capas.filter((entry) => entry.status !== "closed")) {
      const dueDays = capa.due_date ? Math.ceil((new Date(capa.due_date).getTime() - Date.now()) / 86400000) : null;
      items.push({
        id: `capa-${capa.id}`,
        title: capa.capa_number ? `${capa.capa_number} — ${capa.title || "Open CAPA"}` : capa.title || "Open CAPA",
        description:
          `${capa.status ? `Status: ${capa.status}. ` : ""}` +
          (dueDays !== null ? `Due ${dueDays < 0 ? `${Math.abs(dueDays)} days ago` : `in ${dueDays} days`}. ` : "") +
          `${capa.root_cause ? `Root cause: ${capa.root_cause}.` : "Corrective action requires follow-up."}`,
        risk: dueDays !== null && dueDays < 0 ? "critical" : capa.priority === "high" ? "high" : "medium",
        agent: "CAPA Agent",
        timestamp: formatRelativeDate(capa.updated_at || capa.created_at),
        type: "capa",
        score: dueDays !== null && dueDays < 0 ? 91 : capa.priority === "high" ? 79 : 65,
      });
    }

    return items
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ score: _score, ...item }) => item);
  }, [capas, complianceRiskItems, inspections, lots, ncrs, suppliers]);

>>>>>>> 9f646953d77e385adda599188accd0fc908f8667
  return (
    <PageLayout title="Quality Dashboard" subtitle="ISO 13485 Compliance Overview">
      <div className="space-y-6">
        <PriorityList items={priorityItems} />
        <ComplianceChart />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
