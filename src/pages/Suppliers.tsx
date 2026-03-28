import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier } from "@/hooks/useQMS";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit, ShieldCheck, ShieldAlert, ShieldX, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  approved: { label: 'Approved', className: 'bg-status-success/10 text-status-success border-status-success/20', icon: ShieldCheck },
  conditional: { label: 'Conditional', className: 'bg-status-warning/10 text-status-warning border-status-warning/20', icon: ShieldAlert },
  pending: { label: 'Pending', className: 'bg-status-info/10 text-status-info border-status-info/20', icon: ShieldAlert },
  disqualified: { label: 'Disqualified', className: 'bg-status-danger/10 text-status-danger border-status-danger/20', icon: ShieldX },
};

function SupplierFormDialog({ open, onOpenChange, initial, onSubmit }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initial?: Record<string, any>; onSubmit: (data: Record<string, any>) => void;
}) {
  const [form, setForm] = useState(initial || { name: '', code: '', status: 'pending', risk_level: 'medium', contact_email: '', certification_type: '', certification_expiry: '', defect_rate: 0 });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{initial ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); onOpenChange(false); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => set('name', e.target.value)} required /></div>
            <div><Label className="text-xs">Code</Label><Input value={form.code} onChange={e => set('code', e.target.value)} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="conditional">Conditional</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="disqualified">Disqualified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Risk Level</Label>
              <Select value={form.risk_level} onValueChange={v => set('risk_level', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Contact Email</Label><Input type="email" value={form.contact_email || ''} onChange={e => set('contact_email', e.target.value)} /></div>
            <div><Label className="text-xs">Defect Rate %</Label><Input type="number" step="0.01" value={form.defect_rate || 0} onChange={e => set('defect_rate', parseFloat(e.target.value))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Certification Type</Label><Input value={form.certification_type || ''} onChange={e => set('certification_type', e.target.value)} placeholder="ISO 13485" /></div>
            <div><Label className="text-xs">Certification Expiry</Label><Input type="date" value={form.certification_expiry || ''} onChange={e => set('certification_expiry', e.target.value)} /></div>
          </div>
          <Button type="submit" className="w-full">{initial ? 'Update' : 'Create'} Supplier</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const SuppliersPage = () => {
  const { data: suppliers = [], isLoading } = useSuppliers();
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);

  const handleSubmit = (data: Record<string, any>) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
    setEditing(null);
  };

  const certExpired = (d?: string | null) => d ? new Date(d) < new Date() : false;
  const certExpiring = (d?: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  return (
    <PageLayout title="Suppliers" subtitle="Supplier qualification, certifications & FDA forms">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Suppliers', value: suppliers.length },
          { label: 'Approved', value: suppliers.filter(s => s.status === 'approved').length },
          { label: 'Pending', value: suppliers.filter(s => s.status === 'pending').length },
          { label: 'Disqualified', value: suppliers.filter(s => s.status === 'disqualified').length },
        ].map(m => (
          <div key={m.label} className="glass-card rounded-xl p-4">
            <div className="text-2xl font-bold text-foreground">{m.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> Add Supplier</Button>
      </div>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} initial={editing || undefined} onSubmit={handleSubmit} />

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading suppliers...</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No suppliers yet. Add your first supplier above.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Code</TableHead>
                  <TableHead className="text-xs">Supplier</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Risk</TableHead>
                  <TableHead className="text-xs">Defect Rate</TableHead>
                  <TableHead className="text-xs">Certification</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map(supplier => {
                  const sc = statusConfig[supplier.status] || statusConfig.pending;
                  const StatusIcon = sc.icon;
                  return (
                    <TableRow key={supplier.id}>
                      <TableCell className="text-xs font-mono">{supplier.code}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{supplier.name}</div>
                        <div className="text-[10px] text-muted-foreground">{supplier.contact_email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${sc.className}`}>
                          <StatusIcon className="h-3 w-3" /> {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{supplier.risk_level}</Badge></TableCell>
                      <TableCell>
                        <span className={`text-sm font-medium ${Number(supplier.defect_rate) > 2 ? 'text-status-danger' : 'text-status-success'}`}>
                          {supplier.defect_rate}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs">{supplier.certification_type || '—'}</div>
                        {supplier.certification_expiry && (
                          <div className={`text-[10px] ${certExpired(supplier.certification_expiry) ? 'text-status-danger font-semibold' : certExpiring(supplier.certification_expiry) ? 'text-status-warning' : 'text-muted-foreground'}`}>
                            {certExpired(supplier.certification_expiry) ? 'EXPIRED' : `Expires ${supplier.certification_expiry}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setEditing(supplier); setFormOpen(true); }}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-[10px] text-status-danger" onClick={() => deleteMutation.mutate(supplier.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </PageLayout>
  );
};

export default SuppliersPage;
