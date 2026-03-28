import { useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import {
  useCAPAs,
  useCreateCAPA,
  useUpdateCAPA,
  useDeleteCAPA,
  useNCRs,
  useRunCapaAgent,
  useAgentRuns,
} from "@/hooks/useQMS";
import { generateCapaInspectorPackagePdf } from "@/utils/capaInspectorPdf";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle, Clock, ArrowRight, Search, Plus, Trash2, Download, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

function CAPAFormDialog({ open, onOpenChange, onSubmit, ncrs }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  onSubmit: (data: Record<string, any>) => void; ncrs: any[];
}) {
  const [form, setForm] = useState({ capa_number: `CAPA-${Date.now().toString().slice(-4)}`, title: '', description: '', type: 'corrective', status: 'open', priority: 'medium', ncr_id: '', root_cause: '', action_plan: '', assigned_to: '', due_date: '' });
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
        <DialogHeader><DialogTitle>Create CAPA</DialogTitle></DialogHeader>
        <form onSubmit={e => { e.preventDefault(); onSubmit({ ...form, ncr_id: form.ncr_id || null }); onOpenChange(false); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">CAPA Number</Label><Input value={form.capa_number} onChange={e => set('capa_number', e.target.value)} required /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => set('type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="corrective">Corrective</SelectItem><SelectItem value="preventive">Preventive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => set('title', e.target.value)} required /></div>
          <div><Label className="text-xs">Description</Label><Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Priority</Label>
              <Select value={form.priority} onValueChange={v => set('priority', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Linked NCR</Label>
              <Select value={form.ncr_id || 'none'} onValueChange={v => set('ncr_id', v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent><SelectItem value="none">None</SelectItem>{ncrs.map(n => <SelectItem key={n.id} value={n.id}>{n.ncr_number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Assigned To</Label><Input value={form.assigned_to || ''} onChange={e => set('assigned_to', e.target.value)} /></div>
            <div><Label className="text-xs">Due Date</Label><Input type="date" value={form.due_date || ''} onChange={e => set('due_date', e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Root Cause</Label><Textarea value={form.root_cause || ''} onChange={e => set('root_cause', e.target.value)} rows={2} /></div>
          <div><Label className="text-xs">Action Plan</Label><Textarea value={form.action_plan || ''} onChange={e => set('action_plan', e.target.value)} rows={2} /></div>
          <Button type="submit" className="w-full">Create CAPA</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const statusSteps = ['open', 'investigation', 'implementation', 'verification', 'closed'];

const priorityConfig: Record<string, { className: string }> = {
  critical: { className: 'bg-status-danger/10 text-status-danger border-status-danger/20' },
  high: { className: 'bg-status-warning/10 text-status-warning border-status-warning/20' },
  medium: { className: 'bg-status-info/10 text-status-info border-status-info/20' },
  low: { className: 'bg-muted text-muted-foreground border-border' },
};

const CAPAPage = () => {
  const { data: capas = [], isLoading } = useCAPAs();
  const { data: ncrs = [] } = useNCRs();
  const { data: capaAgentRuns = [] } = useAgentRuns("capa");
  const createMutation = useCreateCAPA();
  const updateMutation = useUpdateCAPA();
  const deleteMutation = useDeleteCAPA();
  const capaAgentMutation = useRunCapaAgent();
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [analysisWindow, setAnalysisWindow] = useState<180 | 365>(180);

  const lastCapaRun = capaAgentRuns[0];

  const filtered = capas.filter(c =>
    c.capa_number.toLowerCase().includes(search.toLowerCase()) ||
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageLayout title="CAPA Management" subtitle="Corrective & preventive actions — root cause analysis & tracking">
      <div className="glass-card rounded-xl p-5 border border-agent-capa/20 bg-agent-capa/5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-agent-capa/15 text-agent-capa border border-agent-capa/25">
                <Brain className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">CAPA Agent</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Uses only NCR history, pattern detection, CAPA creation, and engineering notifications.
                </p>
              </div>
            </div>
            {lastCapaRun && (
              <p className="text-[11px] text-muted-foreground border-l-2 border-agent-capa/40 pl-3">
                <span className="font-medium text-foreground/80">Last run:</span>{" "}
                {lastCapaRun.action_taken}
                {lastCapaRun.created_at && (
                  <span className="text-muted-foreground/70"> — {new Date(lastCapaRun.created_at).toLocaleString()}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Select
              value={String(analysisWindow)}
              onValueChange={(v) => setAnalysisWindow(Number(v) as 180 | 365)}
            >
              <SelectTrigger className="h-9 w-[140px] text-xs">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="180">180-day window</SelectItem>
                <SelectItem value="365">365-day window</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="gap-2 h-9"
              disabled={capaAgentMutation.isPending}
              onClick={() => capaAgentMutation.mutate({ days_back: analysisWindow })}
            >
              {capaAgentMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Run CAPA analysis
            </Button>
            <Button
              variant="outline"
              className="gap-2 h-9"
              onClick={() => generateCapaInspectorPackagePdf({ capas, ncrs })}
            >
              <Download className="h-4 w-4" />
              Inspector PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total CAPAs', value: capas.length },
          { label: 'Open', value: capas.filter(c => c.status === 'open' || c.status === 'investigation').length, color: 'text-status-danger' },
          { label: 'Implementation', value: capas.filter(c => c.status === 'implementation').length, color: 'text-status-warning' },
          { label: 'Closed', value: capas.filter(c => c.status === 'closed').length, color: 'text-status-success' },
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
          <Input placeholder="Search CAPAs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New CAPA</Button>
      </div>

      <CAPAFormDialog open={formOpen} onOpenChange={setFormOpen} onSubmit={d => createMutation.mutate(d)} ncrs={ncrs} />

      {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> :
      filtered.length === 0 ? <div className="glass-card p-8 text-center text-muted-foreground">No CAPAs found.</div> : (
        <div className="space-y-4">
          {filtered.map(capa => {
            const currentStep = statusSteps.indexOf(capa.status);
            return (
              <div key={capa.id} className="glass-card overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-medium text-muted-foreground">{capa.capa_number}</span>
                        <Badge variant="outline" className={`text-[10px] capitalize ${priorityConfig[capa.priority]?.className || ''}`}>{capa.priority}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{capa.type}</Badge>
                      </div>
                      <h3 className="font-semibold text-base">{capa.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {capa.assigned_to && `Owner: ${capa.assigned_to} • `}
                        Due: {capa.due_date || '—'}
                        {(capa as any).ncrs && ` • NCR: ${(capa as any).ncrs.ncr_number}`}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[10px] text-status-danger" onClick={() => deleteMutation.mutate(capa.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>

                  <div className="flex items-center gap-1 mt-4">
                    {statusSteps.map((step, i) => (
                      <div key={step} className="flex items-center gap-1">
                        <button
                          onClick={() => updateMutation.mutate({ id: capa.id, status: step })}
                          className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium capitalize transition-colors ${i <= currentStep ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground/50 hover:bg-muted/80'}`}
                        >
                          {i < currentStep ? <CheckCircle className="h-3 w-3" /> : i === currentStep ? <Clock className="h-3 w-3" /> : null}
                          {step}
                        </button>
                        {i < statusSteps.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30" />}
                      </div>
                    ))}
                  </div>
                </div>

                <Dialog>
                  <DialogTrigger asChild>
                    <div className="border-t border-border px-5 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors cursor-pointer">
                      <span className="text-xs text-muted-foreground">View root cause analysis & action plan</span>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1"><Brain className="h-3 w-3" /> Details</Button>
                    </div>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                    <DialogHeader><DialogTitle className="font-semibold text-base">{capa.capa_number} — {capa.title}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      {[
                        { label: 'Description', content: capa.description },
                        { label: 'Root Cause', content: capa.root_cause },
                        { label: 'Action Plan', content: capa.action_plan },
                        { label: 'Effectiveness Check', content: capa.effectiveness_check },
                      ].filter(s => s.content).map(section => (
                        <div key={section.label} className="rounded-lg border border-border bg-accent/30 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{section.label}</div>
                          <p className="text-xs leading-relaxed">{section.content}</p>
                        </div>
                      ))}
                      {(capa.trigger_reason || capa.verification_method || capa.effectiveness_due_date || capa.recurrence_risk) && (
                        <div className="rounded-lg border border-border bg-accent/30 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Effectiveness and Prevention</div>
                          <div className="space-y-2 text-xs">
                            {capa.trigger_reason && <p><span className="text-muted-foreground">Trigger:</span> <span className="font-medium">{capa.trigger_reason}</span></p>}
                            {capa.verification_method && <p><span className="text-muted-foreground">Verification method:</span> <span className="font-medium">{capa.verification_method}</span></p>}
                            {capa.effectiveness_due_date && <p><span className="text-muted-foreground">Effectiveness due:</span> <span className="font-medium">{capa.effectiveness_due_date}</span></p>}
                            {capa.recurrence_risk && <p><span className="text-muted-foreground">Recurrence risk:</span> <span className="font-medium capitalize">{capa.recurrence_risk}</span></p>}
                          </div>
                        </div>
                      )}
                      {capa.source_document_ids?.length > 0 && (
                        <div className="rounded-lg border border-border bg-accent/30 p-4">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Source Traceability</div>
                          <p className="text-xs leading-relaxed">Linked source documents: {capa.source_document_ids.length}</p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
};

export default CAPAPage;
