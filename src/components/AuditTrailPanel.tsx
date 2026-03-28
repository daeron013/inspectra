import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { History, UserRound, Globe, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { listAuditLogs } from "@/lib/api";

function prettyAction(action: string) {
  return action.replace(/\./g, " ").replace(/_/g, " ");
}

function summarizeMetadata(metadata: Record<string, any> | null | undefined) {
  if (!metadata || typeof metadata !== "object") return null;
  if (metadata.file_name) return `File: ${metadata.file_name}`;
  if (metadata.document_type) return `Type: ${metadata.document_type}`;
  if (metadata.title) return `Title: ${metadata.title}`;
  if (metadata.changes && typeof metadata.changes === "object") {
    return `Fields changed: ${Object.keys(metadata.changes).filter((key) => key !== "id").join(", ") || "record updated"}`;
  }
  if (metadata.created_records && typeof metadata.created_records === "object") {
    return `Created: ${Object.keys(metadata.created_records).join(", ") || "linked records"}`;
  }
  return null;
}

export function AuditTrailPanel({
  entityType,
  entityId,
  title = "Audit Trail",
  className = "",
}: {
  entityType: string;
  entityId?: string;
  title?: string;
  className?: string;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["audit-logs", entityType, entityId || "all"],
    queryFn: async () => listAuditLogs(entityType, entityId),
    enabled: !!entityType,
  });

  const items = useMemo(() => data.slice(0, 12), [data]);

  return (
    <div className={`rounded-lg border border-border/50 bg-accent/20 p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading audit history...
        </div>
      ) : items.length === 0 ? (
        <div className="py-4 text-xs text-muted-foreground">No audit events recorded yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const summary = summarizeMetadata(item.metadata);
            return (
              <div key={item.id} className="rounded-md border border-border/40 bg-background/60 p-3">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-medium capitalize text-foreground">{prettyAction(item.action)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {item.actor_name || item.actor_email || item.actor_user_id}
                      </span>
                      {item.request?.method && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {item.request.method}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                    {item.status}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </div>
                {summary && <div className="mt-2 text-xs text-foreground">{summary}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
