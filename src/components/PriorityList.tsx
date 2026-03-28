import { AlertTriangle, AlertOctagon, Info, ChevronRight, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export interface PriorityItem {
  id: string;
  title: string;
  description: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  agent: string;
  timestamp: string;
  type: string;
}

const riskConfig: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  critical: { bg: 'bg-status-danger/10', text: 'text-status-danger', icon: AlertOctagon },
  high: { bg: 'bg-status-warning/10', text: 'text-status-warning', icon: AlertTriangle },
  medium: { bg: 'bg-status-info/10', text: 'text-status-info', icon: Info },
  low: { bg: 'bg-status-success/10', text: 'text-status-success', icon: Info },
};

export function PriorityList({ items }: { items: PriorityItem[] }) {
  const navigate = useNavigate();

  const askAI = (item: PriorityItem) => {
    const prompt = `Analyze this priority action and provide recommendations:\n\nTitle: ${item.title}\nDescription: ${item.description}\nRisk Level: ${item.risk}\nIdentified By: ${item.agent}\nType: ${item.type}\n\nProvide:\n1. Immediate actions to take\n2. Root cause possibilities\n3. ISO 13485 clause references\n4. Recommended timeline`;
    navigate(`/ai?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="glass-card rounded-xl">
      <div className="border-b border-border/50 px-5 py-4">
        <h3 className="font-semibold text-base text-foreground">Priority Actions</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Issues requiring immediate attention</p>
      </div>
      <div className="divide-y divide-border/30">
        {items.length === 0 && (
          <div className="px-5 py-6 text-sm text-muted-foreground">
            No priority actions are currently derived from live QMS data.
          </div>
        )}
        {items.map((item) => {
          const config = riskConfig[item.risk];
          const RiskIcon = config.icon;
          return (
            <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-accent/30 transition-colors group">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${config.bg}`}>
                <RiskIcon className={`h-3.5 w-3.5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${config.bg} ${config.text}`}>
                    {item.risk}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                  <span>{item.agent}</span>
                  <span>•</span>
                  <span>{item.timestamp}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-[10px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => askAI(item)}
              >
                <Bot className="h-3 w-3" /> Ask AI
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground/30 mt-1 group-hover:text-muted-foreground transition-colors" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
