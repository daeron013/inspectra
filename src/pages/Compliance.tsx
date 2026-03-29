import { useMemo, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, AlertTriangle, XCircle, CalendarDays, ShieldCheck, Scale, Sparkles, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSuppliers, useParts, useLots, useInspections, useNCRs, useCAPAs, useRunComplianceAgent, useComplianceAgentItems, useAgentRuns } from "@/hooks/useQMS";

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

const tierBadgeClass: Record<string, string> = {
  P0: "border-status-danger/40 text-status-danger bg-status-danger/10",
  P1: "border-status-warning/40 text-status-warning bg-status-warning/10",
  P2: "border-status-info/40 text-status-info bg-status-info/10",
  P3: "text-muted-foreground",
};

const CompliancePage = () => {
  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();
  const { data: lots = [] } = useLots();
  const { data: inspections = [] } = useInspections();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const complianceAgentMutation = useRunComplianceAgent();
  const { data: complianceRiskItems = [], isLoading: riskItemsLoading } = useComplianceAgentItems(80);
  const { data: complianceAgentRuns = [] } = useAgentRuns("compliance");
  const [horizonDays, setHorizonDays] = useState<180 | 365>(365);
  const lastComplianceRun = complianceAgentRuns[0];

  const latestBatchItems = useMemo(() => {
    const batch = complianceRiskItems[0]?.run_batch_id;
    if (!batch) return [];
    return complianceRiskItems.filter((r: { run_batch_id?: string }) => r.run_batch_id === batch);
  }, [complianceRiskItems]);

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

      <div className="glass-card rounded-xl p-5 border border-agent-compliance/20 bg-agent-compliance/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-agent-compliance/15 text-agent-compliance border border-agent-compliance/25">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Compliance Agent</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Monitors ISO 13485 and FDA compliance gaps across your QMS and flags the highest-risk items.
                </p>
              </div>
            </div>
            {lastComplianceRun && (
              <p className="text-[11px] text-muted-foreground border-l-2 border-agent-compliance/40 pl-3">
                <span className="font-medium text-foreground/80">Last run:</span>{" "}
                {lastComplianceRun.action_taken}
                {lastComplianceRun.created_at && (
                  <span className="text-muted-foreground/70"> — {new Date(lastComplianceRun.created_at).toLocaleString()}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Select value={String(horizonDays)} onValueChange={(v) => setHorizonDays(Number(v) as 180 | 365)}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <SelectValue placeholder="Horizon" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="180">180-day horizon</SelectItem>
                <SelectItem value="365">365-day horizon</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="gap-2 h-9"
              disabled={complianceAgentMutation.isPending}
              onClick={() => complianceAgentMutation.mutate({ horizon_days: horizonDays })}
            >
              {complianceAgentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Run risk prioritization
            </Button>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border/50">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Latest prioritized risks (from agent database)
          </div>
          {riskItemsLoading ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : latestBatchItems.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No prioritized rows yet. Run the agent to populate <code className="text-[10px]">compliance_agent_risk_items</code>.
            </p>
          ) : (
            <ul className="space-y-3">
              {latestBatchItems.map((row: Record<string, unknown>) => (
                <li key={String(row.id)} className="rounded-lg border border-border/50 bg-card/50 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge variant="outline" className={`text-[10px] ${tierBadgeClass[String(row.priority_tier)] || tierBadgeClass.P3}`}>
                      {String(row.priority_tier)}
                    </Badge>
                    <span className="text-xs font-medium text-foreground">{String(row.title)}</span>
                    {row.due_date && (
                      <span className="text-[10px] text-muted-foreground">Due {String(row.due_date)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{String(row.reasoning)}</p>
                  {row.context_factors && (
                    <p className="text-[10px] text-muted-foreground/80 mt-1 font-mono line-clamp-2">{String(row.context_factors)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
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
