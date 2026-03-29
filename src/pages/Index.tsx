import { PageLayout } from "@/components/PageLayout";
import { PriorityList } from "@/components/PriorityList";
import { ComplianceChart } from "@/components/ComplianceChart";
import { useAuth } from "@/hooks/useAuth";
import { useDashboardPriorities } from "@/hooks/useDashboardPriorities";

const Dashboard = () => {
  const { user } = useAuth();
  const organizationLabel = user?.organizationName || user?.organizationId;
  const { items: priorityItems } = useDashboardPriorities(8);

  return (
    <PageLayout title="Quality Dashboard" subtitle="ISO 13485 Compliance Overview">
      <div className="space-y-6">
        {organizationLabel && (
          <section className="rounded-xl border border-border/50 bg-card px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Active Workspace
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{organizationLabel}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              All dashboard metrics, documents, and quality records are scoped to this organization.
            </p>
          </section>
        )}

        <section className="grid gap-6">
          <PriorityList items={priorityItems} />
          <ComplianceChart />
        </section>
      </div>
    </PageLayout>
  );
};

export default Dashboard;
