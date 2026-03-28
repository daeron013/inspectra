import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { useParts, useCreatePart, useUpdatePart, useDeletePart, useSuppliers, useLots, useDevices, useInspections, useNCRs, useCAPAs } from "@/hooks/useQMS";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, ShieldCheck, CheckCircle, XCircle, Clock, AlertTriangle, Search, ArrowRight, Link2, Cpu, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generatePartComplianceReport } from "@/utils/partReportPdf";

function PartFormDialog({ open, onOpenChange, initial, onSubmit, suppliers }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: Record<string, any>; onSubmit: (data: Record<string, any>) => void;
  suppliers: any[];
}) {
  const [form, setForm] = useState(initial || { part_number: '', name: '', description: '', risk_class: 'II', fda_clearance: '', supplier_id: '', unit_cost: 0 });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit Part' : 'Add Part'}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); onOpenChange(false); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Part Number</Label><Input value={form.part_number} onChange={e => set('part_number', e.target.value)} required /></div>
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => set('name', e.target.value)} required /></div>
          </div>
          <div><Label className="text-xs">Description</Label><Input value={form.description || ''} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Risk Class</Label>
              <Select value={form.risk_class} onValueChange={v => set('risk_class', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="I">I</SelectItem><SelectItem value="II">II</SelectItem><SelectItem value="III">III</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">FDA Clearance</Label><Input value={form.fda_clearance || ''} onChange={e => set('fda_clearance', e.target.value)} placeholder="510(k)" /></div>
            <div><Label className="text-xs">Unit Cost</Label><Input type="number" step="0.01" value={form.unit_cost || 0} onChange={e => set('unit_cost', parseFloat(e.target.value))} /></div>
          </div>
          <div><Label className="text-xs">Supplier</Label>
            <Select value={form.supplier_id || ''} onValueChange={v => set('supplier_id', v || null)}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>
                {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full">{initial ? 'Update' : 'Create'} Part</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const PartsPage = () => {
  const navigate = useNavigate();
  const { data: parts = [], isLoading } = useParts();
  const { data: suppliers = [] } = useSuppliers();
  const { data: lots = [] } = useLots();
  const { data: devices = [] } = useDevices();
  const { data: inspections = [] } = useInspections();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const [lotSearch, setLotSearch] = useState('');

  const handleDownloadReport = (part: Record<string, any>) => {
    const supplier = suppliers.find(s => s.id === part.supplier_id) || null;
    const partLots = lots.filter(l => l.part_id === part.id);
    const lotIds = partLots.map(l => l.id);
    const partInspections = inspections.filter(i => i.lot_id && lotIds.includes(i.lot_id));
    const partNCRs = ncrs.filter(n => n.part_id === part.id);
    const ncrIds = partNCRs.map(n => n.id);
    const partCAPAs = capas.filter(c => c.ncr_id && ncrIds.includes(c.ncr_id));
    generatePartComplianceReport({ part, supplier, lots: partLots, inspections: partInspections, ncrs: partNCRs, capas: partCAPAs });
  };
  const createMutation = useCreatePart();
  const updateMutation = useUpdatePart();
  const deleteMutation = useDeletePart();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);

  const handleSubmit = (data: Record<string, any>) => {
    if (editing) updateMutation.mutate({ id: editing.id, ...data });
    else createMutation.mutate(data);
    setEditing(null);
  };

  const isExpired = (d?: string | null) => d ? new Date(d) < new Date() : false;
  const isExpiringSoon = (d?: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  const lotStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="h-3 w-3 text-status-success" />;
    if (status === 'rejected' || status === 'recalled') return <XCircle className="h-3 w-3 text-status-danger" />;
    return <Clock className="h-3 w-3 text-status-warning" />;
  };

  return (
    <PageLayout title="Parts Catalog" subtitle="FDA-approved parts, lot tracking & expiration monitoring">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Parts', value: parts.length },
          { label: 'FDA Cleared', value: parts.filter(p => p.fda_clearance).length },
          { label: 'Active Lots', value: lots.filter(l => l.status === 'approved').length },
          { label: 'Expired Lots', value: lots.filter(l => isExpired(l.expiration_date)).length },
        ].map(m => (
          <div key={m.label} className="glass-card rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Add Part</Button>
      </div>

      <PartFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing || undefined} onSubmit={handleSubmit} suppliers={suppliers} />

      <Tabs defaultValue="catalog">
        <TabsList><TabsTrigger value="catalog">Parts Catalog</TabsTrigger><TabsTrigger value="lots">Lot Inventory</TabsTrigger><TabsTrigger value="trace" className="gap-1"><Link2 className="h-3.5 w-3.5" /> Lot Trace</TabsTrigger></TabsList>
        <TabsContent value="catalog" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> :
            parts.length === 0 ? <div className="p-8 text-center text-muted-foreground">No parts yet.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Part #</TableHead><TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Supplier</TableHead><TableHead className="text-xs">FDA</TableHead>
                  <TableHead className="text-xs">Risk Class</TableHead><TableHead className="text-xs">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {parts.map(part => (
                    <TableRow key={part.id}>
                      <TableCell className="text-xs font-mono">{part.part_number}</TableCell>
                      <TableCell><div className="text-sm font-medium">{part.name}</div><div className="text-[10px] text-muted-foreground">{part.description}</div></TableCell>
                      <TableCell>
                        {(part as any).suppliers?.name ? (
                          <button
                            onClick={() => navigate(`/suppliers/${part.supplier_id}`)}
                            className="text-xs font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0"
                          >
                            {(part as any).suppliers.name}
                          </button>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {part.fda_clearance ? (
                          <div className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-status-success" /><span className="text-[10px] text-status-success">{part.fda_clearance}</span></div>
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">Class {part.risk_class}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" title="Download Compliance Report" onClick={() => handleDownloadReport(part)}><FileDown className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setEditing(part); setFormOpen(true); }}><Edit className="h-3 w-3" /></Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] text-status-danger" onClick={() => deleteMutation.mutate(part.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="lots" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {lots.length === 0 ? <div className="p-8 text-center text-muted-foreground">No lots yet.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Lot #</TableHead><TableHead className="text-xs">Part</TableHead>
                  <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Qty</TableHead>
                  <TableHead className="text-xs">Received</TableHead><TableHead className="text-xs">Expiration</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {lots.map(lot => (
                    <TableRow key={lot.id}>
                      <TableCell className="text-xs font-mono font-medium">{lot.lot_number}</TableCell>
                      <TableCell><div className="text-xs font-medium">{(lot as any).parts?.name || '—'}</div><div className="text-[10px] text-muted-foreground">{(lot as any).parts?.part_number}</div></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] gap-1 capitalize">{lotStatusIcon(lot.status)}{lot.status}</Badge></TableCell>
                      <TableCell className="text-xs font-medium">{lot.quantity}</TableCell>
                      <TableCell className="text-xs">{lot.received_date}</TableCell>
                      <TableCell>
                        {isExpired(lot.expiration_date) ? <span className="text-[10px] font-semibold text-status-danger flex items-center gap-1"><XCircle className="h-3 w-3" /> EXPIRED</span>
                        : isExpiringSoon(lot.expiration_date) ? <span className="text-[10px] text-status-warning flex items-center gap-1"><Clock className="h-3 w-3" /> Expiring</span>
                        : <span className="text-[10px] text-status-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {lot.expiration_date || 'N/A'}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
        <TabsContent value="trace" className="mt-4 space-y-4">
          <div className="max-w-2xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input placeholder="Enter lot number to trace..." value={lotSearch} onChange={e => setLotSearch(e.target.value)} className="pl-12 h-12 text-sm" />
            </div>
          </div>

          {lotSearch.length >= 3 && (() => {
            const matchedLots = lots.filter(l => l.lot_number.toLowerCase().includes(lotSearch.toLowerCase()));
            const getAffectedDevices = (lotId: string) => devices.filter(d => (d as any).device_lots?.some((dl: any) => dl.lot_id === lotId));

            if (matchedLots.length === 0) return (
              <div className="glass-card rounded-xl p-8 text-center">
                <p className="text-sm text-muted-foreground">No lots found matching "{lotSearch}"</p>
              </div>
            );

            return matchedLots.map(lot => {
              const affectedDevices = getAffectedDevices(lot.id);
              const isRecalled = lot.status === 'recalled';
              const isQuarantined = lot.status === 'quarantine';
              const partName = (lot as any).parts?.name || '—';
              const partNumber = (lot as any).parts?.part_number || '';
              const supplierName = (lot as any).suppliers?.name || '—';

              return (
                <div key={lot.id} className="space-y-4">
                  <div className="glass-card rounded-xl p-5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Traceability Chain — {lot.lot_number}</div>
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
            });
          })()}

          {lotSearch.length < 3 && (
            <div className="glass-card rounded-xl p-8 text-center">
              <Link2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-foreground">Search for a Lot Number</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Enter at least 3 characters to trace a lot number through its entire lifecycle.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default PartsPage;
