import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useLots, useDevices } from "@/hooks/useQMS";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, CheckCircle, Cpu, Link2, ArrowRight, XCircle } from "lucide-react";

const LotTracePage = () => {
  const [search, setSearch] = useState('');
  const { data: lots = [] } = useLots();
  const { data: devices = [] } = useDevices();

  const matchedLots = search.length >= 3
    ? lots.filter(l => l.lot_number.toLowerCase().includes(search.toLowerCase()))
    : [];

  const getAffectedDevices = (lotId: string) =>
    devices.filter(d => (d as any).device_lots?.some((dl: any) => dl.lot_id === lotId));

  return (
    <PageLayout title="Lot Traceability" subtitle="Trace any lot number through parts, devices & recall chains">
      <div className="max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input placeholder="Enter lot number to trace..." value={search} onChange={e => setSearch(e.target.value)} className="pl-12 h-12 text-sm" />
        </div>
      </div>

      {matchedLots.length === 0 && search.length >= 3 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-sm text-muted-foreground">No lots found matching "{search}"</p>
        </div>
      )}

      {matchedLots.map(lot => {
        const affectedDevices = getAffectedDevices(lot.id);
        const isRecalled = lot.status === 'recalled';
        const isQuarantined = lot.status === 'quarantine';
        const partName = (lot as any).parts?.name || '—';
        const partNumber = (lot as any).parts?.part_number || '';
        const supplierName = (lot as any).suppliers?.name || '—';

        return (
          <div key={lot.id} className="space-y-4">
            <div className="glass-card rounded-xl p-5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                Traceability Chain — {lot.lot_number}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="rounded-lg border border-border p-3 min-w-[140px]">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Supplier</div>
                  <div className="text-xs font-semibold">{supplierName}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className={`rounded-lg border p-3 min-w-[160px] ${isRecalled ? 'border-status-danger/50 bg-status-danger/5' : isQuarantined ? 'border-status-warning/50 bg-status-warning/5' : 'border-border'}`}>
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Lot</div>
                  <div className="text-xs font-semibold font-mono">{lot.lot_number}</div>
                  <Badge variant="outline" className={`text-[9px] mt-1 capitalize ${isRecalled ? 'bg-status-danger/10 text-status-danger' : isQuarantined ? 'bg-status-warning/10 text-status-warning' : 'bg-status-success/10 text-status-success'}`}>{lot.status}</Badge>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="rounded-lg border border-border p-3 min-w-[140px]">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Part</div>
                  <div className="text-xs font-semibold">{partName}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{partNumber}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="rounded-lg border border-border p-3 min-w-[160px]">
                  <div className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Used In Devices</div>
                  {affectedDevices.length > 0 ? affectedDevices.map(d => (
                    <div key={d.id} className="text-xs font-semibold">{d.name}</div>
                  )) : <div className="text-xs text-muted-foreground">No devices</div>}
                </div>
              </div>
            </div>

            {(isRecalled || isQuarantined) && affectedDevices.length > 0 && (
              <div className="rounded-xl border border-status-danger/30 bg-status-danger/5 p-5">
                <div className="flex items-center gap-2 text-status-danger text-sm font-semibold mb-3">
                  <AlertTriangle className="h-4 w-4" /> Recall Impact Analysis
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Lot <span className="font-mono font-semibold text-foreground">{lot.lot_number}</span> is <span className="font-semibold text-status-danger">{lot.status}</span>. The following devices may need recall:
                </p>
                <div className="space-y-2">
                  {affectedDevices.map(d => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-3">
                      <div className="flex items-center gap-3">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                        <div><div className="text-sm font-medium">{d.name}</div><div className="text-[10px] text-muted-foreground">{d.serial_number}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-4">
              <div className="glass-card rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Lot Details</div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Received:</span><span className="font-medium">{lot.received_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expiry:</span><span className="font-medium">{lot.expiration_date || 'N/A'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Quantity:</span><span className="font-medium">{lot.quantity}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Inspection:</span><span className="font-medium capitalize">{lot.inspection_status}</span></div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Audit Trail</div>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div>✓ Lot record created {lot.created_at?.split('T')[0]}</div>
                  {lot.inspection_status === 'passed' && <div>✓ Incoming inspection passed</div>}
                  {isRecalled && <div className="text-status-danger font-medium">⚠ Recall initiated</div>}
                  {isQuarantined && <div className="text-status-warning font-medium">⚠ Quarantined — awaiting disposition</div>}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {search.length < 3 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <Link2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">Search for a Lot Number</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Enter at least 3 characters to trace a lot number through its entire lifecycle.
          </p>
        </div>
      )}
    </PageLayout>
  );
};

export default LotTracePage;
