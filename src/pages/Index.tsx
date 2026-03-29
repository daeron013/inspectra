import { PageLayout } from "@/components/PageLayout";
import { PriorityList } from "@/components/PriorityList";
import { useDashboardPriorities } from "@/hooks/useDashboardPriorities";

const Dashboard = () => {
  const { items: priorityItems } = useDashboardPriorities(8);

  return (
    <PageLayout title="Quality Dashboard" subtitle="ISO 13485 Compliance Overview">
      <div className="space-y-6">
        <PriorityList items={priorityItems} />
      </div>
    </PageLayout>
  );
};

export default Dashboard;
