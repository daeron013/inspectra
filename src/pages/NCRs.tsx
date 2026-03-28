import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useNCRs, useCreateNCR, useUpdateNCR, useDeleteNCR, useLots, useParts, useSuppliers } from "@/hooks/useQMS";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle, XCircle, Clock, Search, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function NCRFormDialog({ open, onOpenChange, onSubmit, lots, parts, suppliers }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: Record<string, any>) => void; lots: any[]; parts: any[]; suppliers: any[];
}) {
  const [form, setForm] = useState({ ncr_number: `NCR-${Date.now().toString().slice(-4)}`, title: '', description: '', severity: 'minor', status: 'open', lot_id: '', part_id: '', supplier_id: '', root_cause: '', disposition: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader><DialogTitle>Create NCR</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); onOpenChange(false); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">NCR Number</Label><Input value={form.ncr_number} onChange={e => set('ncr_number', e.target.value)} required /></div>
            <div><Label className="text-xs">Severity</Label>
              <Select value={form.severity} onValueChange={v => set('severity', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="major">Major</SelectItem><SelectItem value="minor">Minor</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Lot</Label>
              <Select value={form.lot_id || 'none'} onValueChange={v => set('lot_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{lots.map(l => <SelectItem key={l.id} value={l.id}>{l.lot_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Part</Label>
              <Select value={form.part_id || 'none'} onValueChange={v => set('part_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{parts.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Supplier</Label>
              <Select value={form.supplier_id || 'none'} onValueChange={v => set('supplier_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Root Cause</Label><Textarea value={form.root_cause || ''} onChange={e => set('root_cause', e.target.value)} rows={2} /></div>
          <div><Label className="text-xs">Disposition</Label>
            <Select value={form.disposition || 'none'} onValueChange={v => set('disposition', v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Pending</SelectItem><SelectItem value="use_as_is">Use As-Is</SelectItem><SelectItem value="rework">Rework</SelectItem><SelectItem value="scrap">Scrap</SelectItem><SelectItem value="return_to_supplier">Return to Supplier</SelectItem></SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">Create NCR</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const severityConfig: Record<string, { className: string }> = {
  critical: { className: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
  major: { className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  minor: { className: 'bg-status-info/10 text-status-info border-status-info/20' },
};

const statusConfig: Record<string, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  open: { className: 'bg-status-danger/10 text-status-danger border-status-danger/20', icon: AlertTriangle },
  investigating: { className: 'bg-status-warning/10 text-status-warning border-status-warning/20', icon: Clock },
  disposition: { className: 'bg-status-info/10 text-status-info border-status-info/20', icon: Clock },
  closed: { className: 'bg-status-success/10 text-status-success border-status-success/20', icon: CheckCircle },
};

const NCRsPage = () => {
  const { data: ncrs = [], isLoading } = useNCRs();
  const { data: lots = [] } = useLots();
  const { data: parts = [] } = useParts();
  const { data: suppliers = [] } = useSuppliers();
  const createMutation = useCreateNCR();
  const updateMutation = useUpdateNCR();
  const deleteMutation = useDeleteNCR();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);

  const filtered = ncrs.filter(n =>
    n.ncr_number.toLowerCase().includes(search.toLowerCase()) ||
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageLayout title="Nonconformances" subtitle="NCR tracking, disposition & root cause analysis">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total NCRs', value: ncrs.length },
          { label: 'Open', value: ncrs.filter(n => n.status === 'open').length, color: 'text-status-danger' },
          { label: 'Investigating', value: ncrs.filter(n => n.status === 'investigating').length, color: 'text-status-warning' },
          { label: 'Closed', value: ncrs.filter(n => n.status === 'closed').length, color: 'text-status-success' },
        ].map(m => (
          <div key={m.label} className="glass-card p-5">
            <div className={`text-3xl font-semibold ${'color' in m ? m.color : 'text-foreground'}`}>{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search NCRs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New NCR</Button>
      </div>

      <NCRFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={d => createMutation.mutate(d)} lots={lots} parts={parts} suppliers={suppliers} />

      <div className="glass-card overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> :
        filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground">No NCRs found.</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">NCR #</TableHead><TableHead className="text-xs">Title</TableHead>
              <TableHead className="text-xs">Lot</TableHead><TableHead className="text-xs">Severity</TableHead>
              <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Disposition</TableHead>
              <TableHead className="text-xs">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(ncr => {
                const sev = severityConfig[ncr.severity] || severityConfig.minor;
                const stat = statusConfig[ncr.status] || statusConfig.open;
                const StatIcon = stat.icon;
                return (
                  <TableRow key={ncr.id}>
                    <TableCell className="text-xs font-mono font-medium">{ncr.ncr_number}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium max-w-[250px]">{ncr.title}</div>
                      <div className="text-[10px] text-muted-foreground">{(ncr as any).suppliers?.name || '—'}</div>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{(ncr as any).lots?.lot_number || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className={`text-[10px] capitalize ${sev.className}`}>{ncr.severity}</Badge></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] gap-1 capitalize ${stat.className}`}>
                        <StatIcon className="h-3 w-3" /> {ncr.status}
                      </Badge>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px] capitalize">{ncr.disposition?.replace(/_/g, ' ') || 'pending'}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild><Button variant="outline" size="sm" className="h-7 text-[10px]">Details</Button></DialogTrigger>
                          <DialogContent className="max-w-lg">
                            <DialogHeader><DialogTitle className="text-base font-semibold">{ncr.ncr_number} — {ncr.title}</DialogTitle></DialogHeader>
                            <div className="space-y-4 text-sm">
                              {ncr.description && <div className="rounded-lg border border-border bg-accent/30 p-4"><div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Description</div><p className="text-xs leading-relaxed">{ncr.description}</p></div>}
                              {ncr.root_cause && <div className="rounded-lg border border-border bg-accent/30 p-4"><div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Root Cause</div><p className="text-xs leading-relaxed">{ncr.root_cause}</p></div>}
                              {(ncr.detected_date || ncr.detection_source || ncr.affected_quantity != null) && (
                                <div className="rounded-lg border border-border bg-accent/30 p-4">
                                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Detection</div>
                                  <div className="space-y-1.5 text-xs">
                                    <div><span className="text-muted-foreground">Detected date:</span> <span className="font-medium">{ncr.detected_date || '—'}</span></div>
                                    <div><span className="text-muted-foreground">Source:</span> <span className="font-medium">{ncr.detection_source || '—'}</span></div>
                                    <div><span className="text-muted-foreground">Affected quantity:</span> <span className="font-medium">{ncr.affected_quantity ?? '—'}</span></div>
                                  </div>
                                </div>
                              )}
                              {(ncr.disposition_reason || ncr.containment_action || ncr.impact_assessment) && (
                                <div className="rounded-lg border border-border bg-accent/30 p-4">
                                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Disposition and Impact</div>
                                  <div className="space-y-2 text-xs">
                                    {ncr.disposition_reason && <p><span className="text-muted-foreground">Reason:</span> <span className="font-medium">{ncr.disposition_reason}</span></p>}
                                    {ncr.containment_action && <p><span className="text-muted-foreground">Containment:</span> <span className="font-medium">{ncr.containment_action}</span></p>}
                                    {ncr.impact_assessment && <p><span className="text-muted-foreground">Impact:</span> <span className="font-medium">{ncr.impact_assessment}</span></p>}
                                  </div>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: ncr.id, status: 'closed' })}>Close NCR</Button>
                                <Button size="sm" variant="outline" className="text-status-danger" onClick={() => deleteMutation.mutate(ncr.id)}>Delete</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="outline" size="sm" className="h-7 text-[10px] text-status-danger" onClick={() => deleteMutation.mutate(ncr.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageLayout>
  );
};

export default NCRsPage;
