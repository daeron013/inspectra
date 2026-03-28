import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, XCircle, CalendarDays, ShieldCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ComplianceItem {
  id: string;
  title: string;
  type: 'requalification' | 'audit' | 'review' | 'recertification';
  entity: string;
  dueDate: string;
  status: 'completed' | 'upcoming' | 'overdue' | 'in-progress';
  daysRemaining: number;
  lastCompleted?: string;
  frequency: string;
}

const complianceItems: ComplianceItem[] = [
  { id: 'CMP-001', title: 'Supplier Requalification', type: 'requalification', entity: 'MedTech Components Ltd (S-112)', dueDate: '2024-12-15', status: 'overdue', daysRemaining: -10, lastCompleted: '2024-09-15', frequency: 'Quarterly' },
  { id: 'CMP-002', title: 'Supplier Requalification', type: 'requalification', entity: 'SterileTech Solutions (S-301)', dueDate: '2024-11-05', status: 'overdue', daysRemaining: -50, lastCompleted: '2024-08-05', frequency: 'Quarterly' },
  { id: 'CMP-003', title: 'Supplier Requalification', type: 'requalification', entity: 'BioSafe Packaging Corp (S-087)', dueDate: '2025-01-20', status: 'upcoming', daysRemaining: 26, lastCompleted: '2024-10-20', frequency: 'Quarterly' },
  { id: 'CMP-004', title: 'Supplier Requalification', type: 'requalification', entity: 'PrecisionMed Plastics (S-203)', dueDate: '2025-02-01', status: 'upcoming', daysRemaining: 38, lastCompleted: '2024-11-01', frequency: 'Quarterly' },
  { id: 'CMP-005', title: 'Supplier Requalification', type: 'requalification', entity: 'TitanAlloy Medical (S-156)', dueDate: '2025-02-10', status: 'upcoming', daysRemaining: 47, lastCompleted: '2024-11-10', frequency: 'Quarterly' },
  { id: 'CMP-006', title: 'Internal QMS Audit', type: 'audit', entity: 'Full ISO 13485 Scope', dueDate: '2025-03-15', status: 'upcoming', daysRemaining: 80, lastCompleted: '2024-09-15', frequency: 'Semi-annual' },
  { id: 'CMP-007', title: 'Management Review', type: 'review', entity: 'Quality Management System', dueDate: '2025-01-30', status: 'upcoming', daysRemaining: 36, lastCompleted: '2024-07-30', frequency: 'Semi-annual' },
  { id: 'CMP-008', title: 'ISO 13485 Surveillance Audit', type: 'audit', entity: 'External — Notified Body', dueDate: '2025-06-01', status: 'upcoming', daysRemaining: 158, lastCompleted: '2024-06-01', frequency: 'Annual' },
  { id: 'CMP-009', title: 'CAPA Effectiveness Review', type: 'review', entity: 'CAPA-015 Seal Temperature', dueDate: '2025-01-15', status: 'completed', daysRemaining: 0, lastCompleted: '2024-12-20', frequency: 'Per CAPA' },
  { id: 'CMP-010', title: 'ISO 9001 Recertification', type: 'recertification', entity: 'MedTech Components Ltd', dueDate: '2024-06-15', status: 'overdue', daysRemaining: -193, lastCompleted: '2021-06-15', frequency: 'Triennial' },
];

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  completed: { label: 'Completed', className: 'bg-status-success/10 text-status-success border-status-success/20', icon: CheckCircle },
  upcoming: { label: 'Upcoming', className: 'bg-status-info/10 text-status-info border-status-info/20', icon: Clock },
  overdue: { label: 'Overdue', className: 'bg-status-danger/10 text-status-danger border-status-danger/20', icon: XCircle },
  'in-progress': { label: 'In Progress', className: 'bg-status-warning/10 text-status-warning border-status-warning/20', icon: Clock },
};

const CompliancePage = () => {
  const overdue = complianceItems.filter(c => c.status === 'overdue');
  const upcoming = complianceItems.filter(c => c.status === 'upcoming').sort((a, b) => a.daysRemaining - b.daysRemaining);
  const completed = complianceItems.filter(c => c.status === 'completed');

  const overallScore = Math.round(((complianceItems.length - overdue.length) / complianceItems.length) * 100);

  return (
    <PageLayout title="Compliance Calendar" subtitle="Deadlines, requalifications, audits & regulatory tracking">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5">
          <div className="text-3xl font-semibold text-foreground">{overallScore}%</div>
          <div className="text-xs text-muted-foreground mt-1">Compliance Score</div>
          <Progress value={overallScore} className="mt-2 h-1.5" />
        </div>
        <div className="glass-card p-5">
          <div className="text-3xl font-semibold text-status-danger">{overdue.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Overdue Items</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-3xl font-semibold text-status-warning">{upcoming.filter(u => u.daysRemaining <= 30).length}</div>
          <div className="text-xs text-muted-foreground mt-1">Due in 30 Days</div>
        </div>
        <div className="glass-card p-5">
          <div className="text-3xl font-semibold text-status-success">{completed.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Completed</div>
        </div>
      </div>

      {/* Overdue section */}
      {overdue.length > 0 && (
        <div className="glass-card overflow-hidden border-status-danger/30">
          <div className="border-b border-status-danger/20 bg-status-danger/5 px-5 py-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-status-danger" />
            <h3 className="font-semibold text-base text-status-danger">Overdue ({overdue.length})</h3>
          </div>
          <div className="divide-y divide-border/30">
            {overdue.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.entity}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Frequency: {item.frequency} • Last: {item.lastCompleted}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-status-danger">{Math.abs(item.daysRemaining)} days overdue</div>
                  <div className="text-[10px] text-muted-foreground">Due: {item.dueDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming section */}
      <div className="glass-card overflow-hidden">
        <div className="border-b border-border px-5 py-4 flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-semibold text-base">Upcoming ({upcoming.length})</h3>
        </div>
        <div className="divide-y divide-border/30">
          {upcoming.map(item => {
            const urgent = item.daysRemaining <= 30;
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.title}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{item.type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.entity}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Frequency: {item.frequency}</div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${urgent ? 'text-status-warning' : 'text-foreground'}`}>
                    {item.daysRemaining} days
                  </div>
                  <div className="text-[10px] text-muted-foreground">Due: {item.dueDate}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completed section */}
      {completed.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-border px-5 py-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-status-success" />
            <h3 className="font-semibold text-base text-status-success">Recently Completed</h3>
          </div>
          <div className="divide-y divide-border/30">
            {completed.map(item => (
              <div key={item.id} className="flex items-center justify-between px-5 py-4 opacity-70">
                <div>
                  <div className="text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{item.entity}</div>
                </div>
                <Badge variant="outline" className="text-[10px] bg-status-success/10 text-status-success border-status-success/20 gap-1">
                  <CheckCircle className="h-3 w-3" /> Completed {item.lastCompleted}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
};

export default CompliancePage;
