import { PageLayout } from "@/components/PageLayout";
import { PriorityList } from "@/components/PriorityList";
import { ComplianceChart } from "@/components/ComplianceChart";
import { priorityItems } from "@/data/mockData";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { user } = useAuth();
  const organizationName = user?.organizationName;

  return (
    <PageLayout title="Quality Dashboard" subtitle="ISO 13485 Compliance Overview">
      <div className="space-y-6">
        {organizationName && (
          <section className="rounded-xl border border-border/50 bg-card px-5 py-4 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Active Workspace
            </div>
            <div className="mt-2 text-lg font-semibold text-foreground">{organizationName}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              All dashboard metrics, documents, and quality records are scoped to this organization.
            </p>
          </section>
        )}
        <PriorityList items={priorityItems} />
        <ComplianceChart />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
