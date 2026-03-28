import { PageLayout } from "@/components/PageLayout";
import { PriorityList, type PriorityItem } from "@/components/PriorityList";
import { ComplianceChart } from "@/components/ComplianceChart";
import { useSuppliers, useLots, useNCRs, useCAPAs } from "@/hooks/useQMS";

function daysFromNow(dateString?: string | null) {
  if (!dateString) return null;
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86400000);
}

function relativeLabel(days: number | null) {
  if (days === null) return "unknown";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "due today";
  return `due in ${days}d`;
}

function buildPriorityItems({
  suppliers,
  lots,
  ncrs,
  capas,
}: {
  suppliers: any[];
  lots: any[];
  ncrs: any[];
  capas: any[];
}): PriorityItem[] {
  const items: PriorityItem[] = [];

  suppliers.forEach((supplier) => {
    const requalDays = daysFromNow(supplier.requalification_due_date);
    if (requalDays !== null && requalDays <= 14) {
      items.push({
        id: `supplier-${supplier.id}`,
        title: `Requalify ${supplier.name}`,
        description: `Supplier ${supplier.code || ""} is ${relativeLabel(requalDays)}. Risk level: ${supplier.risk_level || "unknown"}.`,
        risk: requalDays < 0 || supplier.risk_level === "critical" ? "critical" : "high",
        agent: "Compliance Agent",
        timestamp: supplier.requalification_due_date || "unknown",
        type: "requalification",
      });
    }
  });

  lots.forEach((lot) => {
    if (lot.inspection_status !== "passed" && lot.received_date) {
      const age = Math.floor((Date.now() - new Date(lot.received_date).getTime()) / 86400000);
      if (age >= 3) {
        items.push({
          id: `lot-${lot.id}`,
          title: `Missing inspection record — Lot ${lot.lot_number}`,
          description: `Received ${age} days ago from ${(lot as any).suppliers?.name || "supplier unknown"} and still marked ${lot.inspection_status || "pending"}.`,
          risk: age >= 7 ? "high" : "medium",
          agent: "Inspection Agent",
          timestamp: lot.received_date,
          type: "inspection",
        });
      }
    }
  });

  ncrs
    .filter((ncr) => ncr.status !== "closed")
    .slice(0, 5)
    .forEach((ncr) => {
      items.push({
        id: `ncr-${ncr.id}`,
        title: `${ncr.ncr_number} — ${ncr.title}`,
        description: `${ncr.severity || "unknown"} severity nonconformance is still ${ncr.status}. Disposition: ${ncr.disposition || "pending"}.`,
        risk: ncr.severity === "critical" ? "critical" : ncr.severity === "major" ? "high" : "medium",
        agent: "Inspection Agent",
        timestamp: ncr.detected_date || ncr.created_at || "unknown",
        type: "ncr",
      });
    });

  capas
    .filter((capa) => capa.status !== "closed")
    .forEach((capa) => {
      const dueDays = daysFromNow(capa.due_date);
      if (dueDays !== null && dueDays <= 14) {
        items.push({
          id: `capa-${capa.id}`,
          title: `CAPA follow-up — ${capa.capa_number}`,
          description: `${capa.title} is ${relativeLabel(dueDays)}. Priority: ${capa.priority || "medium"}.`,
          risk: dueDays < 0 || capa.priority === "critical" ? "critical" : capa.priority === "high" ? "high" : "medium",
          agent: "CAPA Agent",
          timestamp: capa.due_date || "unknown",
          type: "capa",
        });
      }
    });

  const riskRank = { critical: 0, high: 1, medium: 2, low: 3 };
  return items
    .sort((a, b) => riskRank[a.risk] - riskRank[b.risk])
    .slice(0, 6);
}

function buildChartData({ suppliers, ncrs, capas }: { suppliers: any[]; ncrs: any[]; capas: any[] }) {
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const month = date.toLocaleString("en-US", { month: "short" });
    return { key, month, ncrs: 0, capas: 0 };
  });

  const monthMap = new Map(months.map((entry) => [entry.key, entry]));

  ncrs.forEach((ncr) => {
    const created = new Date(ncr.created_at || ncr.detected_date || "");
    if (Number.isNaN(created.getTime())) return;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = monthMap.get(key);
    if (bucket) bucket.ncrs += 1;
  });

  capas.forEach((capa) => {
    const created = new Date(capa.created_at || capa.due_date || "");
    if (Number.isNaN(created.getTime())) return;
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const bucket = monthMap.get(key);
    if (bucket) bucket.capas += 1;
  });

  const defects = suppliers.length
    ? Number((suppliers.reduce((sum, supplier) => sum + Number(supplier.defect_rate || 0), 0) / suppliers.length).toFixed(1))
    : 0;

  return months.map((entry) => ({
    month: entry.month,
    ncrs: entry.ncrs,
    capas: entry.capas,
    defects,
  }));
}

const Dashboard = () => {
  const { data: suppliers = [] } = useSuppliers();
  const { data: lots = [] } = useLots();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const priorityItems = buildPriorityItems({ suppliers, lots, ncrs, capas });
  const chartData = buildChartData({ suppliers, ncrs, capas });

  return (
    <PageLayout title="Quality Dashboard" subtitle="ISO 13485 Compliance Overview">
      <div className="space-y-6">
        <PriorityList items={priorityItems} />
        <ComplianceChart data={chartData} />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
