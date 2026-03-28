import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { GitCompareArrows, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listVersionSnapshots, type VersionSnapshotRecord } from "@/lib/api";

function changedKeys(snapshot: VersionSnapshotRecord) {
  const before = snapshot.before || {};
  const after = snapshot.after || {};
  return Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
}

function prettyValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

export function VersionHistoryPanel({
  entityType,
  entityId,
  title = "Version History",
  className = "",
}: {
  entityType: string;
  entityId?: string;
  title?: string;
  className?: string;
}) {
  const [selected, setSelected] = useState<VersionSnapshotRecord | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["version-snapshots", entityType, entityId || "all"],
    queryFn: async () => listVersionSnapshots(entityType, entityId),
    enabled: !!entityType,
  });

  const items = useMemo(() => data.slice(0, 10), [data]);

  return (
    <>
      <div className={`rounded-lg border border-border/50 bg-accent/20 p-4 ${className}`}>
        <div className="mb-3 flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading version history...
          </div>
        ) : items.length === 0 ? (
          <div className="py-4 text-xs text-muted-foreground">No versions recorded yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const keys = changedKeys(item);
              return (
                <div key={item.id} className="rounded-md border border-border/40 bg-background/60 p-3">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium capitalize text-foreground">{item.event_type}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {keys.length || (item.event_type === "created" ? "new" : item.event_type === "deleted" ? "removed" : "snapshot")}
                    </Badge>
                  </div>
                  <div className="text-xs text-foreground">
                    {keys.length > 0 ? `Changed: ${keys.slice(0, 4).join(", ")}${keys.length > 4 ? "..." : ""}` : "Full record snapshot"}
                  </div>
                  <Button variant="ghost" size="sm" className="mt-2 h-7 px-0 text-[11px]" onClick={() => setSelected(item)}>
                    View before/after
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {selected?.event_type} snapshot
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-border/50 bg-accent/20 p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Before</div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-[11px] text-foreground">
                  {prettyValue(selected.before)}
                </pre>
              </div>
              <div className="rounded-lg border border-border/50 bg-accent/20 p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">After</div>
                <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words text-[11px] text-foreground">
                  {prettyValue(selected.after)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
