import { PageLayout } from "@/components/PageLayout";
import { PriorityList } from "@/components/PriorityList";
import { ComplianceChart } from "@/components/ComplianceChart";
import { priorityItems } from "@/data/mockData";

const Dashboard = () => {
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
