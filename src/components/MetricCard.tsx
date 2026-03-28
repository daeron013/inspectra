import { Search, AlertTriangle, ShieldAlert, Clock, TrendingUp, TrendingDown } from "lucide-react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  search: Search,
  'alert-triangle': AlertTriangle,
  'shield-alert': ShieldAlert,
  clock: Clock,
};

const statusClasses: Record<string, string> = {
  success: 'bg-status-success/10 text-status-success border-status-success/20',
  warning: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  danger: 'bg-status-danger/10 text-status-danger border-status-danger/20',
  info: 'bg-status-info/10 text-status-info border-status-info/20',
};

interface MetricCardProps {
  label: string;
  value: number;
  change: number;
  status: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
}

export function MetricCard({ label, value, change, status, icon }: MetricCardProps) {
  const Icon = iconMap[icon] || Search;
  const isPositiveChange = change > 0;

  return (
    <div className="glass-card rounded-xl p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${statusClasses[status]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {change !== 0 && (
          <div className={`flex items-center gap-1 text-xs font-medium ${isPositiveChange ? 'text-status-danger' : 'text-status-success'}`}>
            {isPositiveChange ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositiveChange ? '+' : ''}{change}
          </div>
        )}
      </div>
      <div className="mt-3">
        <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
