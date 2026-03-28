import { useParams, useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { useSuppliers, useParts, useInspections, useNCRs, useCAPAs, useLots, useRunSupplierAgent, useAgentRuns } from "@/hooks/useQMS";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ShieldCheck, ShieldAlert, ShieldX, Package, Search, AlertTriangle, Brain, Sparkles, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditTrailPanel } from "@/components/AuditTrailPanel";
import { VersionHistoryPanel } from "@/components/VersionHistoryPanel";

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  approved: { label: 'Approved', className: 'bg-status-success/10 text-status-success border-status-success/20', icon: ShieldCheck },
  conditional: { label: 'Conditional', className: 'bg-status-warning/10 text-status-warning border-status-warning/20', icon: ShieldAlert },
  pending: { label: 'Pending', className: 'bg-status-info/10 text-status-info border-status-info/20', icon: ShieldAlert },
  disqualified: { label: 'Disqualified', className: 'bg-status-danger/10 text-status-danger border-status-danger/20', icon: ShieldX },
};

const riskColors: Record<string, string> = {
  critical: 'text-status-danger',
  high: 'text-status-danger',
  medium: 'text-status-warning',
  low: 'text-status-success',
};

const SupplierDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();
  const { data: lots = [] } = useLots();
  const { data: inspections = [] } = useInspections();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const supplierAgentMutation = useRunSupplierAgent();
  const { data: supplierAgentRuns = [] } = useAgentRuns("supplier");

  const supplier = suppliers.find(s => s.id === id);
  if (!supplier) {
    return (
      <PageLayout title="Supplier Not Found" subtitle="">
        <Button variant="outline" onClick={() => navigate('/parts')} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Parts
        </Button>
      </PageLayout>
    );
  }

  const sc = statusConfig[supplier.status] || statusConfig.pending;
  const StatusIcon = sc.icon;

  const supplierParts = parts.filter(p => p.supplier_id === id);
  const supplierLots = lots.filter(l => l.supplier_id === id);
  const lotIds = supplierLots.map(l => l.id);
  const supplierInspections = inspections.filter(i => i.lot_id && lotIds.includes(i.lot_id));
  const supplierNCRs = ncrs.filter(n => n.supplier_id === id);
  const ncrIds = supplierNCRs.map(n => n.id);
  const supplierCAPAs = capas.filter(c => c.ncr_id && ncrIds.includes(c.ncr_id));

  const certExpired = (d?: string | null) => d ? new Date(d) < new Date() : false;
  const certExpiring = (d?: string | null) => {
    if (!d) return false;
    const diff = (new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff < 90;
  };

  const lastSupplierRun = supplierAgentRuns[0];
  const agentSummary = (supplier as { supplier_agent_summary?: string }).supplier_agent_summary;

  return (
    <PageLayout title={supplier.name} subtitle={`Supplier ${supplier.code} — Compliance & linked records`}>
      <Button variant="outline" size="sm" onClick={() => navigate('/parts')} className="gap-2 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Parts
      </Button>

      <div className="glass-card rounded-xl p-4 mb-4 border border-agent-supplier/20 bg-agent-supplier/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Brain className="h-4 w-4 text-agent-supplier shrink-0" />
            Supplier Agent
          </div>
          {lastSupplierRun && (
            <p className="text-[11px] text-muted-foreground line-clamp-2">
              Last portfolio run: {lastSupplierRun.action_taken}
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="gap-2 shrink-0"
          disabled={supplierAgentMutation.isPending}
          onClick={() => supplierAgentMutation.mutate({ days_back: 365, supplier_id: id })}
        >
          {supplierAgentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Run for this supplier
        </Button>
      </div>

      {agentSummary && (
        <div className="glass-card rounded-xl p-4 mb-4 border border-border/60">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Latest agent assessment</div>
          <p className="text-xs text-foreground leading-relaxed">{agentSummary}</p>
        </div>
      )}

      {/* Overview cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Status</div>
          <Badge variant="outline" className={`text-xs gap-1 ${sc.className}`}>
            <StatusIcon className="h-3 w-3" /> {sc.label}
          </Badge>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Risk Level</div>
          <span className={`text-lg font-bold capitalize ${riskColors[supplier.risk_level] || ''}`}>{supplier.risk_level}</span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Defect Rate</div>
          <span className={`text-lg font-bold ${Number(supplier.defect_rate) > 2 ? 'text-status-danger' : 'text-status-success'}`}>
            {supplier.defect_rate ?? 0}%
          </span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">On-Time Delivery</div>
          <span className="text-lg font-bold text-foreground">{supplier.on_time_delivery ?? 100}%</span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Certification</div>
          <div className="text-xs font-medium">{supplier.certification_type || '—'}</div>
          {supplier.certification_expiry && (
            <div className={`text-[10px] ${certExpired(supplier.certification_expiry) ? 'text-status-danger font-semibold' : certExpiring(supplier.certification_expiry) ? 'text-status-warning' : 'text-muted-foreground'}`}>
              {certExpired(supplier.certification_expiry) ? 'EXPIRED' : `Expires ${supplier.certification_expiry}`}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Audit Score</div>
          <span className="text-lg font-bold text-foreground">{supplier.audit_score ?? '—'}</span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Requalification Due</div>
          <span className="text-sm font-semibold text-foreground">{supplier.requalification_due_date || '—'}</span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Quality Agreement</div>
          <span className="text-sm font-semibold text-foreground">{supplier.quality_agreement_signed ? 'Signed' : 'Unknown'}</span>
        </div>
        <div className="glass-card rounded-xl p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Supplier Type</div>
          <span className="text-sm font-semibold text-foreground">{supplier.supplier_type || '—'}</span>
        </div>
      </div>

      {/* Contact & audit info */}
      <div className="glass-card rounded-xl p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Contact & Audit Details</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{supplier.contact_email || '—'}</span></div>
          <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{supplier.contact_phone || '—'}</span></div>
          <div><span className="text-muted-foreground">Last Audit:</span> <span className="font-medium">{supplier.last_audit_date || '—'}</span></div>
          <div><span className="text-muted-foreground">Next Audit:</span> <span className="font-medium">{supplier.next_audit_date || '—'}</span></div>
          <div><span className="text-muted-foreground">Approved Since:</span> <span className="font-medium">{supplier.approved_since || '—'}</span></div>
          <div><span className="text-muted-foreground">Last Requalification:</span> <span className="font-medium">{supplier.last_requalification_date || '—'}</span></div>
          <div><span className="text-muted-foreground">Requalification Cadence:</span> <span className="font-medium">{supplier.requalification_frequency_days ? `${supplier.requalification_frequency_days} days` : '—'}</span></div>
          <div><span className="text-muted-foreground">Country:</span> <span className="font-medium">{supplier.country || '—'}</span></div>
        </div>
        {supplier.address && <div className="text-xs mt-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium">{supplier.address}</span></div>}
        {Array.isArray(supplier.certifications) && supplier.certifications.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Certification History</div>
            <div className="space-y-2 text-xs">
              {supplier.certifications.map((cert: any, index: number) => (
                <div key={`cert-${index}`} className="rounded-md border border-border/40 p-3">
                  <div className="font-medium">{cert.name || 'Certification'}</div>
                  <div className="text-muted-foreground">{[cert.certificate_number, cert.issuing_body, cert.status].filter(Boolean).join(' · ') || '—'}</div>
                  <div className="text-muted-foreground">{[cert.effective_date, cert.expiry_date].filter(Boolean).join(' to ') || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(supplier.audit_findings) && supplier.audit_findings.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Audit Findings</div>
            <div className="space-y-2 text-xs">
              {supplier.audit_findings.map((finding: any, index: number) => (
                <div key={`finding-${index}`} className="rounded-md border border-border/40 p-3">
                  <div className="font-medium">{finding.finding || 'Finding'}</div>
                  <div className="text-muted-foreground">{[finding.severity, finding.status].filter(Boolean).join(' · ') || '—'}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AuditTrailPanel entityType="suppliers" entityId={supplier.id} className="glass-card" />
        <VersionHistoryPanel entityType="suppliers" entityId={supplier.id} className="glass-card" />
      </div>

      {/* Tabs for linked records */}
      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts" className="gap-1"><Package className="h-3.5 w-3.5" /> Parts ({supplierParts.length})</TabsTrigger>
          <TabsTrigger value="inspections" className="gap-1"><Search className="h-3.5 w-3.5" /> Inspections ({supplierInspections.length})</TabsTrigger>
          <TabsTrigger value="ncrs" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> NCRs ({supplierNCRs.length})</TabsTrigger>
          <TabsTrigger value="capas" className="gap-1"><Brain className="h-3.5 w-3.5" /> CAPAs ({supplierCAPAs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {supplierParts.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No parts from this supplier.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Part #</TableHead><TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Risk Class</TableHead><TableHead className="text-xs">FDA</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {supplierParts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs font-mono">{p.part_number}</TableCell>
                      <TableCell className="text-sm font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">Class {p.risk_class}</Badge></TableCell>
                      <TableCell className="text-xs">{p.fda_clearance || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inspections" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {supplierInspections.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No inspections linked to this supplier.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Sample</TableHead>
                  <TableHead className="text-xs">Defects</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {supplierInspections.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs">{i.inspection_date}</TableCell>
                      <TableCell className="text-xs capitalize">{i.inspection_type}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{i.status}</Badge></TableCell>
                      <TableCell className="text-xs">{i.sample_size ?? '—'}</TableCell>
                      <TableCell className="text-xs">{i.defects_found ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ncrs" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {supplierNCRs.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No nonconformances for this supplier.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">NCR #</TableHead><TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Severity</TableHead><TableHead className="text-xs">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {supplierNCRs.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="text-xs font-mono">{n.ncr_number}</TableCell>
                      <TableCell className="text-sm">{n.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{n.severity}</Badge></TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{n.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="capas" className="mt-4">
          <div className="glass-card rounded-xl overflow-hidden">
            {supplierCAPAs.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No CAPAs linked to this supplier.</div> : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">CAPA #</TableHead><TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {supplierCAPAs.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs font-mono">{c.capa_number}</TableCell>
                      <TableCell className="text-sm">{c.title}</TableCell>
                      <TableCell className="text-xs capitalize">{c.type}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
};

export default SupplierDetailPage;
