import { AgentRun } from "@/data/mockData";
import { Package, Search, AlertTriangle, Brain, Clock } from "lucide-react";

const agentConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  supplier: { icon: Package, color: 'bg-agent-supplier/15 text-agent-supplier border-agent-supplier/25' },
  inspection: { icon: Search, color: 'bg-agent-inspection/15 text-agent-inspection border-agent-inspection/25' },
  ncr: { icon: AlertTriangle, color: 'bg-agent-ncr/15 text-agent-ncr border-agent-ncr/25' },
  capa: { icon: Brain, color: 'bg-agent-capa/15 text-agent-capa border-agent-capa/25' },
  compliance: { icon: Clock, color: 'bg-agent-compliance/15 text-agent-compliance border-agent-compliance/25' },
};

export function AgentFeed({ runs }: { runs: AgentRun[] }) {
  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-status-success status-pulse" />
          <h3 className="font-semibold text-base text-foreground">Agent Activity</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Real-time AI agent operations</p>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        <div className="divide-y divide-border/30">
          {runs.map((run) => {
            const config = agentConfig[run.agent];
            const Icon = config.icon;
            return (
              <div key={run.id} className="px-5 py-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`flex h-5 w-5 items-center justify-center rounded border ${config.color}`}>
                    <Icon className="h-2.5 w-2.5" />
                  </div>
                  <span className="text-[11px] font-semibold text-foreground">{run.agentLabel}</span>
                  <span className="text-[10px] text-muted-foreground/60 ml-auto">{run.timestamp}</span>
                </div>
                <div className="ml-7">
                  <p className="text-xs font-medium text-foreground/80">{run.action}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{run.detail}</p>
                  {run.result && (
                    <div className="mt-1.5 inline-block rounded-md bg-accent/50 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                      {run.result}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
