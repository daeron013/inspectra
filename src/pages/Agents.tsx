import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { agentRuns } from "@/data/mockData";
import type { AgentRun } from "@/data/mockData";
import { Package, Search, Brain, Clock, ChevronDown, ChevronUp } from "lucide-react";

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
      "Deadline scanning, audit tracking, and regulatory calendar — prioritizes which dates matter using cross-domain context (sole-source exposure, device risk class, audit history)",
    color: "text-agent-compliance",
  },
};

function groupByAgent(runs: AgentRun[]): Record<string, AgentRun[]> {
  const grouped: Record<string, AgentRun[]> = {};
  for (const run of runs) {
    if (!grouped[run.agent]) grouped[run.agent] = [];
    grouped[run.agent].push(run);
  }
  return grouped;
}

const AgentsPage = () => {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const grouped = groupByAgent(agentRuns);
  const agentKeys = Object.keys(agentConfig);

  return (
    <PageLayout title="Agent Activity" subtitle="Record of AI agent actions across your QMS">
      <div className="space-y-3">
        {agentKeys.map((key) => {
          const config = agentConfig[key];
          const runs = grouped[key] || [];
          const lastRun = runs[0];
          const Icon = config.icon;
          const isExpanded = expandedAgent === key;

          return (
            <div key={key} className="glass-card rounded-xl overflow-hidden">
              {/* Card header — always visible */}
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
                    <span className="text-[10px] text-muted-foreground">{config.description}</span>
                  </div>
                  {lastRun ? (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Last action: <span className="text-foreground/80">{lastRun.action}</span> — {lastRun.timestamp}
                      {lastRun.result && <span className="ml-2 text-primary font-medium">{lastRun.result}</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">No actions recorded</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground">{runs.length} action{runs.length !== 1 ? "s" : ""}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded action list */}
              {isExpanded && (
                <div className="border-t border-border/50">
                  {runs.length === 0 ? (
                    <div className="px-5 py-6 text-center text-xs text-muted-foreground">
                      No actions recorded for this agent yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {runs.map((run) => (
                        <div key={run.id} className="px-5 py-3 flex items-start gap-3">
                          <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground">{run.action}</span>
                              <span className="text-[10px] text-muted-foreground/60 ml-auto shrink-0">{run.timestamp}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{run.detail}</p>
                            {run.result && (
                              <span className="inline-block mt-1.5 rounded-md bg-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                                {run.result}
                              </span>
                            )}
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
    </PageLayout>
  );
};

export default AgentsPage;
