import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useInspections, useCreateInspection, useUpdateInspection, useLots } from "@/hooks/useQMS";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, ClipboardCheck, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

function InspectionFormDialog({ open, onOpenChange, onSubmit, lots }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: Record<string, any>) => void; lots: any[];
}) {
  const [form, setForm] = useState({ lot_id: '', inspection_type: 'incoming', status: 'pending', inspector_name: '', sample_size: 0, defects_found: 0, notes: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New Inspection</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); onOpenChange(false); }} className="space-y-3">
          <div><Label className="text-xs">Lot</Label>
            <Select value={form.lot_id} onValueChange={v => set('lot_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select lot" /></SelectTrigger>
              <SelectContent>{lots.map(l => <SelectItem key={l.id} value={l.id}>{l.lot_number} — {(l as any).parts?.name || ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Type</Label>
              <Select value={form.inspection_type} onValueChange={v => set('inspection_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="incoming">Incoming</SelectItem><SelectItem value="in_process">In-Process</SelectItem><SelectItem value="final">Final</SelectItem><SelectItem value="requalification">Requalification</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="passed">Passed</SelectItem><SelectItem value="failed">Failed</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Inspector</Label><Input value={form.inspector_name} onChange={e => set('inspector_name', e.target.value)} /></div>
            <div><Label className="text-xs">Sample Size</Label><Input type="number" value={form.sample_size} onChange={e => set('sample_size', parseInt(e.target.value))} /></div>
            <div><Label className="text-xs">Defects</Label><Input type="number" value={form.defects_found} onChange={e => set('defects_found', parseInt(e.target.value))} /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} /></div>
          <Button type="submit" className="w-full">Create Inspection</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const InspectionsPage = () => {
  const { data: inspections = [], isLoading } = useInspections();
  const { data: lots = [] } = useLots();
  const createMutation = useCreateInspection();
  const updateMutation = useUpdateInspection();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  const filtered = inspections.filter(i => {
    const lotNum = (i as any).lots?.lot_number || '';
    const partName = (i as any).lots?.parts?.name || '';
    return lotNum.toLowerCase().includes(search.toLowerCase()) || partName.toLowerCase().includes(search.toLowerCase()) || (i.inspector_name || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <PageLayout title="Inspections" subtitle="Incoming, in-process & final inspection records">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: inspections.length },
          { label: 'Passed', value: inspections.filter(i => i.status === 'passed').length, color: 'text-status-success' },
          { label: 'Failed', value: inspections.filter(i => i.status === 'failed').length, color: 'text-status-danger' },
          { label: 'Pending', value: inspections.filter(i => i.status === 'pending').length, color: 'text-status-warning' },
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
          <Input placeholder="Search lot, part, or inspector..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New Inspection</Button>
      </div>

      <InspectionFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={d => createMutation.mutate(d)} lots={lots} />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="glass-card overflow-hidden">
            <div className="border-b border-border px-5 py-4"><h3 className="font-semibold text-base">Inspection Records</h3></div>
            {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> :
            filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground">No inspections yet.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Lot / Part</TableHead><TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Samples</TableHead><TableHead className="text-xs">Defects</TableHead>
                  <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Date</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map(ins => (
                    <TableRow key={ins.id} className="cursor-pointer" onClick={() => setSelected(ins)}>
                      <TableCell>
                        <div className="text-sm font-medium">{(ins as any).lots?.parts?.name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{(ins as any).lots?.lot_number || '—'}</div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{ins.inspection_type}</Badge></TableCell>
                      <TableCell className="text-xs">{ins.sample_size}</TableCell>
                      <TableCell><span className={`text-xs font-medium ${(ins.defects_found || 0) > 0 ? 'text-status-danger' : 'text-status-success'}`}>{ins.defects_found || 0}</span></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${ins.status === 'passed' ? 'bg-status-success/10 text-status-success border-status-success/20' : ins.status === 'failed' ? 'bg-status-danger/10 text-status-danger border-status-danger/20' : 'bg-status-warning/10 text-status-warning border-status-warning/20'}`}>
                          {ins.status === 'passed' ? <CheckCircle className="h-3 w-3" /> : ins.status === 'failed' ? <XCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {ins.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{ins.inspection_date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
        <div>
          {selected ? (
            <div className="glass-card p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-base">{(selected as any).lots?.parts?.name || 'Inspection'}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{(selected as any).lots?.lot_number}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-muted-foreground">Inspector:</span><div className="font-medium">{selected.inspector_name || '—'}</div></div>
                <div><span className="text-muted-foreground">Sample Size:</span><div className="font-medium">{selected.sample_size}</div></div>
                <div><span className="text-muted-foreground">Defects:</span><div className="font-medium">{selected.defects_found || 0}</div></div>
                <div><span className="text-muted-foreground">Type:</span><div className="font-medium capitalize">{selected.inspection_type}</div></div>
                <div><span className="text-muted-foreground">Rejected Units:</span><div className="font-medium">{selected.rejected_units ?? '—'}</div></div>
                <div><span className="text-muted-foreground">Sampling / AQL:</span><div className="font-medium">{`${selected.sampling_plan || '—'} / ${selected.aql_level || '—'}`}</div></div>
              </div>
              {(selected.acceptance_criteria || selected.environmental_conditions || selected.equipment_used?.length > 0) && (
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Inspection Controls</div>
                  {selected.acceptance_criteria && <p className="text-xs"><span className="text-muted-foreground">Acceptance criteria:</span> <span className="font-medium">{selected.acceptance_criteria}</span></p>}
                  {selected.environmental_conditions && <p className="text-xs"><span className="text-muted-foreground">Environment:</span> <span className="font-medium">{selected.environmental_conditions}</span></p>}
                  {selected.equipment_used?.length > 0 && <p className="text-xs"><span className="text-muted-foreground">Equipment:</span> <span className="font-medium">{selected.equipment_used.join(', ')}</span></p>}
                </div>
              )}
              {selected.defect_categories?.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Defect Categories</div>
                  <div className="space-y-1.5">
                    {selected.defect_categories.map((item: any, index: number) => (
                      <div key={`${item.category}-${index}`} className="text-xs flex justify-between gap-4">
                        <span className="text-muted-foreground">{item.category || 'Unspecified'}</span>
                        <span className="font-medium">{item.count ?? '—'}{item.severity ? ` · ${item.severity}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.measurements?.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Measured Characteristics</div>
                  <div className="space-y-1.5">
                    {selected.measurements.map((item: any, index: number) => (
                      <div key={`${item.parameter}-${index}`} className="text-xs">
                        <span className="font-medium">{item.parameter || 'Measurement'}</span>
                        <span className="text-muted-foreground"> · {item.value || '—'}{item.unit ? ` ${item.unit}` : ''} · spec {item.spec_min || '—'} to {item.spec_max || '—'} · {item.result || 'unknown'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.notes && (
                <div className="rounded-lg border border-border p-3">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Notes</div>
                  <p className="text-xs">{selected.notes}</p>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => updateMutation.mutate({ id: selected.id, status: 'passed' })}>Mark Passed</Button>
                <Button size="sm" variant="outline" className="text-xs text-status-danger" onClick={() => updateMutation.mutate({ id: selected.id, status: 'failed' })}>Mark Failed</Button>
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <ClipboardCheck className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Select an inspection to view details</p>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default InspectionsPage;
