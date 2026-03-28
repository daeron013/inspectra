import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useAgentRuns, useResolveAgentRun } from "@/hooks/useQMS";
import { Package, Search, Brain, Clock, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

type AgentRun = {
  id: string;
  agent: "supplier" | "inspection" | "capa" | "compliance";
  agentLabel: string;
  action: string;
  detail: string;
  timestamp: string;
  result?: string;
};

const agentConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string; description: string; color: string }> = {
  supplier: {
    icon: Package,
    label: "Supplier Agent",
    description: "Supplier risk scoring, certification expiry, and defect rate trends",
    color: "text-agent-supplier",
  },
  inspection: {
    icon: Search,
    label: "Inspection Agent",
    description: "Anomaly detection on inspection data — flags defects and opens NCRs when warranted",
    color: "text-agent-inspection",
  },
  capa: {
    icon: Brain,
    label: "CAPA Agent",
    description: "Reads NCR history, detects recurring patterns, and initiates CAPAs",
    color: "text-agent-capa",
  },
  compliance: {
    icon: Clock,
    label: "Compliance Agent",
    description:
      "Regulatory risk prioritizer — ranks which deadlines matter using cross-domain context (supplier dependency, device risk class, audit history). Separate compliance_agent_* data stores.",
    color: "text-agent-compliance",
  },
};

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} days ago`;
}

function groupByAgentType(runs: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const run of runs) {
    const key = run.agent_type;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(run);
  }
  return grouped;
}

function displayTimestamp(value?: string | null) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildAgentRuns({
  suppliers,
  lots,
  ncrs,
  capas,
  documents,
}: {
  suppliers: any[];
  lots: any[];
  ncrs: any[];
  capas: any[];
  documents: any[];
}): AgentRun[] {
  const runs: AgentRun[] = [];

  suppliers.forEach((supplier) => {
    if (supplier.risk_level === "critical" || supplier.risk_level === "high" || Number(supplier.defect_rate) > 2) {
      runs.push({
        id: `supplier-${supplier.id}`,
        agent: "supplier",
        agentLabel: "Supplier Agent",
        action: "Supplier risk scoring refresh",
        detail: `${supplier.name} is currently ${supplier.risk_level || "unknown"} risk with defect rate ${supplier.defect_rate ?? 0}% and status ${supplier.status || "unknown"}.`,
        timestamp: displayTimestamp(supplier.updated_at || supplier.requalification_due_date || supplier.last_audit_date),
        result: supplier.status ? `Status → ${supplier.status}` : undefined,
      });
    }
  });

  lots.forEach((lot) => {
    if (lot.inspection_status !== "passed") {
      runs.push({
        id: `lot-${lot.id}`,
        agent: "inspection",
        agentLabel: "Inspection Agent",
        action: "Inspection follow-up required",
        detail: `Lot ${lot.lot_number} for ${(lot as any).parts?.name || "unknown part"} is still marked ${lot.inspection_status || "pending"} with status ${lot.status || "unknown"}.`,
        timestamp: displayTimestamp(lot.updated_at || lot.received_date),
        result: `Inspection ${lot.inspection_status || "pending"}`,
      });
    }
  });

  ncrs.forEach((ncr) => {
    if (ncr.status !== "closed") {
      runs.push({
        id: `ncr-${ncr.id}`,
        agent: "inspection",
        agentLabel: "Inspection Agent",
        action: "Nonconformance opened or still active",
        detail: `${ncr.ncr_number} remains ${ncr.status}. Severity: ${ncr.severity || "unknown"}. Disposition: ${ncr.disposition || "pending"}.`,
        timestamp: displayTimestamp(ncr.updated_at || ncr.detected_date || ncr.created_at),
        result: ncr.disposition ? `Disposition → ${ncr.disposition}` : "Open NCR",
      });
    }
  });

  capas.forEach((capa) => {
    if (capa.status !== "closed") {
      runs.push({
        id: `capa-${capa.id}`,
        agent: "capa",
        agentLabel: "CAPA Agent",
        action: "CAPA tracking in progress",
        detail: `${capa.capa_number} is ${capa.status}. Priority: ${capa.priority || "medium"}. Root cause: ${capa.root_cause || "not yet documented"}.`,
        timestamp: displayTimestamp(capa.updated_at || capa.due_date || capa.created_at),
        result: capa.due_date ? `Due ${capa.due_date}` : "CAPA active",
      });
    }
  });

  documents.forEach((document) => {
    const complianceFlags = document.compliance_signals?.audit_readiness_flags || [];
    const missingRecords = document.compliance_signals?.missing_records || [];
    if (complianceFlags.length > 0 || missingRecords.length > 0) {
      runs.push({
        id: `document-${document.id}`,
        agent: "compliance",
        agentLabel: "Compliance Agent",
        action: "Document compliance scan updated",
        detail: `${document.title || document.file_name || "Document"} has ${complianceFlags.length} audit flags and ${missingRecords.length} missing-record findings.`,
        timestamp: displayTimestamp(document.updated_at || document.created_at),
        result: document.status ? `Document ${document.status}` : undefined,
      });
    }
  });

  return runs
    .sort((a, b) => {
      const aTime = new Date(a.timestamp).getTime();
      const bTime = new Date(b.timestamp).getTime();
      return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
    })
    .slice(0, 40);
}

const AgentsPage = () => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const { data: runs = [], isLoading } = useAgentRuns();
  const resolveMutation = useResolveAgentRun();
  const grouped = groupByAgentType(runs);
  const agentKeys = Object.keys(agentConfig);

  return (
    <PageLayout title="Agent Activity" subtitle="Record of AI agent actions across your QMS">
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm">Loading agent activity...</div>
      ) : (
        <div className="space-y-3">
          {agentKeys.map((key) => {
            const config = agentConfig[key];
            const agentRuns = grouped[key] || [];
            const lastRun = agentRuns[0];
            const Icon = config.icon;
            const isExpanded = expandedAgent === key;
            const pendingReview = agentRuns.filter((r) => r.requires_human_review && r.status !== "completed").length;

            return (
              <div key={key} className="glass-card rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedAgent(isExpanded ? null : key)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-accent/30 transition-colors"
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-accent/50 ${config.color}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{config.label}</span>
                      {pendingReview > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-status-warning/15 px-2 py-0.5 text-[10px] font-medium text-status-warning">
                          <AlertTriangle className="h-3 w-3" />{pendingReview} needs review
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{config.description}</p>
                    {lastRun ? (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Last: <span className="text-foreground/80">{lastRun.action_taken}</span> — {formatRelativeTime(lastRun.created_at)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">No actions recorded</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-muted-foreground">{agentRuns.length} run{agentRuns.length !== 1 ? "s" : ""}</span>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border/50">
                    {agentRuns.length === 0 ? (
                      <div className="px-5 py-6 text-center text-xs text-muted-foreground">No actions recorded for this agent yet.</div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {agentRuns.map((run) => (
                          <div key={run.id} className="px-5 py-3 flex items-start gap-3">
                            <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${run.status === "failed" ? "bg-status-danger" : run.requires_human_review ? "bg-status-warning" : "bg-status-success"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">{run.action_taken}</span>
                                <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">{formatRelativeTime(run.created_at)}</span>
                              </div>
                              {run.reasoning && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-3">{run.reasoning}</p>}
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${run.status === "failed" ? "bg-status-danger/10 text-status-danger" : run.requires_human_review ? "bg-status-warning/10 text-status-warning" : "bg-status-success/10 text-status-success"}`}>
                                  {run.status === "failed" ? "Failed" : run.requires_human_review ? "Needs review" : "Completed"}
                                </span>
                                {run.confidence != null && (
                                  <span className="text-[10px] text-muted-foreground">{Math.round(run.confidence * 100)}% confidence</span>
                                )}
                                {run.requires_human_review && run.status !== "completed" && (
                                  <Button size="sm" variant="outline" className="ml-auto h-6 text-[10px] px-2"
                                    onClick={(e) => { e.stopPropagation(); resolveMutation.mutate(run.id); }}>
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default AgentsPage;
