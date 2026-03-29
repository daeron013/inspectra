import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Eye, Printer, ExternalLink, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSuppliers, useParts, useLots, useInspections, useNCRs, useCAPAs } from "@/hooks/useQMS";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { deleteDocument, getDocumentFileUrl, listDocuments } from "@/lib/api";
import { generateDocumentAuditPdf } from "@/utils/documentAuditPdf";
import {
  generateApprovedSupplierListPdf,
  generateIncomingInspectionPacketPdf,
  generateManagementReviewPdf,
  generateNcrCapaRegisterPdf,
  generateRequalificationPlanPdf,
} from "@/utils/complianceDocumentPdf";
import { generateSupplierInspectionPacketPdf } from "@/utils/inspectionPacketPdf";
import { useToast } from "@/hooks/use-toast";

const typeLabels: Record<string, string> = {
  supplier_certificate: 'Certificate',
  inspection_sheet: 'Inspection',
  batch_record: 'Batch Record',
  ncr_note: 'NCR Note',
  sop_spec: 'SOP / Spec',
};

const statusClasses: Record<string, string> = {
  draft: 'bg-status-warning/10 text-status-warning border-status-warning/20',
  processing: 'bg-status-info/10 text-status-info border-status-info/20',
  processed: 'bg-status-success/10 text-status-success border-status-success/20',
  flagged: 'bg-status-danger/10 text-status-danger border-status-danger/20',
};

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/50 bg-accent/20 p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value || "—"}</div>
    </div>
  );
}

function ListField({ title, items }: { title: string; items?: string[] }) {
  const values = items && items.length > 0 ? items : ["—"];
  return (
    <div className="space-y-1">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      {values.map((item, index) => (
        <div key={`${title}-${index}`} className="text-xs">• {item}</div>
      ))}
    </div>
  );
}

function useDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => listDocuments(user!.id),
    enabled: !!user,
  });
}

// ─── Document Viewer Dialog ───────────────────────────────
function DocumentViewer({ doc, open, onClose }: { doc: any; open: boolean; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const loadFile = async () => {
    if (!doc?.id || !user?.id) return;
    setLoading(true);
    try {
      const url = await getDocumentFileUrl(doc.id, user.id);
      setFileUrl(url);
    } catch {
      setFileUrl(null);
    } finally {
      setLoading(false);
    }
  };

  // Load when opened
  if (open && !fileUrl && !loading && doc?.id) {
    loadFile();
  }

  const isPdf = doc?.file_name?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(doc?.file_name || '');
  const extracted = doc?.extracted_data || {};
  const compliance = doc?.compliance_signals || extracted.compliance || {};
  const traceability = doc?.traceability_map || extracted.traceability || {};

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setFileUrl(null); } }}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            {doc?.title || doc?.file_name}
          </DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">{typeLabels[doc?.document_type] || doc?.document_type}</Badge>
          <span>v{doc?.version || '1.0'}</span>
          {doc?.file_size && <span>· {(doc.file_size / 1024).toFixed(0)} KB</span>}
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-primary hover:underline">
              <Download className="h-3 w-3" /> Download
            </a>
          )}
          <button onClick={() => generateDocumentAuditPdf(doc)} className="flex items-center gap-1 text-primary hover:underline">
            <Printer className="h-3 w-3" /> Export audit PDF
          </button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.95fr)] gap-4 overflow-y-auto">
          <div className="min-h-[400px] rounded-lg border border-border overflow-hidden bg-accent/20">
            {loading && (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading document...</div>
            )}
            {!loading && !fileUrl && !doc?.file_path && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 p-8">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No file attached to this document record.</p>
                {doc?.notes && <p className="text-xs text-muted-foreground mt-2">{doc.notes}</p>}
              </div>
            )}
            {!loading && fileUrl && isPdf && (
              <iframe src={fileUrl} className="w-full h-full min-h-[500px]" title={doc?.title} />
            )}
            {!loading && fileUrl && isImage && (
              <div className="flex items-center justify-center h-full p-4">
                <img src={fileUrl} alt={doc?.title} className="max-w-full max-h-full object-contain rounded" />
              </div>
            )}
            {!loading && fileUrl && !isPdf && !isImage && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-8">
                <FileText className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Preview not available for this file type.</p>
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="gap-1"><ExternalLink className="h-3 w-3" /> Open in new tab</Button>
                </a>
              </div>
            )}
          </div>

          <div className="space-y-4 pb-2">
            <DetailSection title="Document Control">
              <Field label="Document Number" value={doc.document_number || extracted.document_control?.document_number} />
              <Field label="Version / Revision" value={`${doc.version || "1.0"} / ${doc.revision || extracted.document_control?.revision || "—"}`} />
              <Field label="Effective Date" value={doc.effective_date || extracted.document_control?.effective_date} />
              <Field label="Approval Date" value={doc.approval_date || extracted.document_control?.approval_date} />
              <Field label="Owner" value={doc.document_owner || extracted.document_control?.document_owner} />
              <Field label="Approvers" value={(doc.approvers || extracted.document_control?.approvers || []).join(", ")} />
              <Field label="Summary" value={doc.notes || extracted.summary} />
            </DetailSection>

            <DetailSection title="Supplier Qualification">
              <Field label="Supplier" value={extracted.supplier?.name} />
              <Field label="Status / Risk" value={`${extracted.supplier?.status || "—"} / ${extracted.supplier?.risk_level || "—"}`} />
              <Field label="Supplier Type" value={extracted.supplier?.supplier_type} />
              <Field label="Certification" value={extracted.supplier?.certification_type} />
              <Field label="Audit Score" value={extracted.supplier?.audit_score} />
              <Field label="Requalification Due" value={extracted.supplier?.requalification_due_date} />
              <Field label="Quality Agreement" value={extracted.supplier?.quality_agreement_signed ? "Signed" : "Unknown"} />
            </DetailSection>

            <DetailSection title="Traceability">
              <Field label="Part / Drawing" value={`${extracted.part?.part_number || "—"} / ${extracted.part?.drawing_number || "—"}`} />
              <Field label="Lot / Batch" value={`${extracted.lot?.lot_number || "—"} / ${extracted.lot?.batch_number || traceability.supplier_batch || "—"}`} />
              <Field label="Receiving Record" value={traceability.receiving_record} />
              <Field label="CoC / CoA" value={`${extracted.lot?.certificate_of_conformance || "—"} / ${extracted.lot?.certificate_of_analysis || "—"}`} />
              <Field label="Finished Devices" value={(traceability.finished_device_ids || []).join(", ")} />
              <Field label="Affected Products" value={(traceability.affected_products || []).join(", ")} />
            </DetailSection>

            <DetailSection title="Inspection and Quality">
              <Field label="Inspection Type" value={extracted.inspection?.inspection_type} />
              <Field label="Inspector" value={extracted.inspection?.inspector_name} />
              <Field label="Sampling / AQL" value={`${extracted.inspection?.sampling_plan || "—"} / ${extracted.inspection?.aql_level || "—"}`} />
              <Field label="Sample / Defects / Rejected" value={`${extracted.inspection?.sample_size ?? "—"} / ${extracted.inspection?.defects_found ?? "—"} / ${extracted.inspection?.rejected_units ?? "—"}`} />
              <Field label="Acceptance Criteria" value={extracted.inspection?.acceptance_criteria} />
            </DetailSection>

            <DetailSection title="NCR and CAPA">
              <Field label="NCR" value={extracted.ncr?.title} />
              <Field label="Disposition" value={extracted.ncr?.disposition} />
              <Field label="Root Cause" value={extracted.ncr?.root_cause || extracted.capa?.root_cause} />
              <Field label="Containment" value={extracted.ncr?.containment_action} />
              <Field label="CAPA" value={extracted.capa?.title} />
              <Field label="Action Plan" value={extracted.capa?.action_plan} />
              <Field label="Effectiveness Check" value={extracted.capa?.effectiveness_check} />
            </DetailSection>

            <DetailSection title="Compliance Signals">
              <ListField title="ISO 13485 Clauses" items={compliance.iso_13485_clauses} />
              <ListField title="FDA 21 CFR 820 Sections" items={compliance.fda_21_cfr_820_sections} />
              <ListField title="Audit Readiness Flags" items={compliance.audit_readiness_flags} />
              <ListField title="Missing Records" items={compliance.missing_records} />
              <ListField title="Upcoming Deadlines" items={(compliance.upcoming_deadlines || []).map((item: any) => `${item.item} — ${item.due_date} (${item.priority || "normal"})`)} />
            </DetailSection>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Inspector Packets ────────────────────────────────────
function InspectorPackets({ suppliers, parts }: { suppliers: any[]; parts: any[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {suppliers.map((supplier: any) => {
        const supplierParts = parts.filter((p: any) => p.supplier_id === supplier.id);
        const daysSinceAudit = supplier.last_audit_date
          ? Math.floor((Date.now() - new Date(supplier.last_audit_date).getTime()) / 86400000)
          : null;
        const certDaysLeft = supplier.certification_expiry
          ? Math.floor((new Date(supplier.certification_expiry).getTime() - Date.now()) / 86400000)
          : null;

        return (
          <div key={supplier.id} className="glass-card rounded-xl p-5 space-y-3 border border-border/50">
            <div>
              <h4 className="text-sm font-semibold text-foreground">{supplier.name}</h4>
              <p className="text-[10px] text-muted-foreground">ISO 13485 supplier packet · {supplier.name}</p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">What They Make For Us</div>
              <p className="text-xs text-foreground">{supplierParts.length > 0 ? supplierParts.map((p: any) => p.name).join(", ") : "No parts currently linked"}</p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Main Quality Contact</div>
              <p className="text-xs text-foreground">{supplier.contact_email || "Not on file"}</p>
              {supplier.contact_phone && <p className="text-xs text-muted-foreground">{supplier.contact_phone}</p>}
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Address</div>
              <p className="text-xs text-foreground">{supplier.address || "Not on file"}</p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Controlled Certificates</div>
              <p className="text-xs text-foreground">
                {supplier.certification_type || "None"}{supplier.certification_expiry ? ` · expires ${supplier.certification_expiry}` : ""}
                {certDaysLeft !== null && certDaysLeft < 60 && (
                  <span className={`ml-1 text-[10px] ${certDaysLeft < 0 ? 'text-status-danger' : 'text-status-warning'}`}>
                    ({certDaysLeft < 0 ? 'EXPIRED' : `${certDaysLeft}d left`})
                  </span>
                )}
              </p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Audit and Requalification</div>
              <p className="text-xs text-foreground">
                {daysSinceAudit !== null ? `${daysSinceAudit} days ago` : "No audit on file"}
                {daysSinceAudit !== null && daysSinceAudit > 90 && (
                  <span className="text-status-warning text-[10px] ml-1">— follow-up overdue</span>
                )}
              </p>
              {supplier.requalification_due_date && (
                <p className="text-xs text-muted-foreground mt-1">Requalification due: {supplier.requalification_due_date}</p>
              )}
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Our Part Numbers From Them</div>
              <p className="text-xs text-foreground">{supplierParts.length > 0 ? supplierParts.map((p: any) => `${p.part_number} ${p.name}`).join(", ") : "None linked"}</p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">ISO 13485 Focus</div>
              <p className="text-xs text-foreground">Supplier qualification, external provider control, requalification evidence, and traceable linked parts.</p>
            </div>
            <Button
              size="sm"
              className="w-full mt-2 h-8 text-xs gap-1"
              onClick={() => generateSupplierInspectionPacketPdf({ supplier, parts: supplierParts })}
            >
              <Printer className="h-3 w-3" /> Generate packet PDF
            </Button>
          </div>
        );
      })}
      {suppliers.length === 0 && (
        <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
          No suppliers found. Add suppliers first to generate inspector packets.
        </div>
      )}
    </div>
  );
}

function IsoDocumentDrafts({
  suppliers,
  parts,
  lots,
  inspections,
  ncrs,
  capas,
}: {
  suppliers: any[];
  parts: any[];
  lots: any[];
  inspections: any[];
  ncrs: any[];
  capas: any[];
}) {
  const qmsData = { suppliers, parts, lots, inspections, ncrs, capas };
  const documentCards = [
    {
      title: "Approved Supplier List",
      description: "Controlled draft supplier register with qualification status, certificates, risk level, and requalification timing.",
      onClick: () => generateApprovedSupplierListPdf(qmsData),
    },
    {
      title: "Supplier Requalification Plan",
      description: "Risk-based requalification and audit schedule aligned to supplier oversight expectations.",
      onClick: () => generateRequalificationPlanPdf(qmsData),
    },
    {
      title: "Incoming Inspection Packet",
      description: "Receiving-inspection evidence packet aligned to incoming inspection control and nonconformance handling.",
      onClick: () => generateIncomingInspectionPacketPdf(qmsData),
    },
    {
      title: "NCR and CAPA Register",
      description: "Inspection-ready register of open quality events, dispositions, corrective actions, and due dates.",
      onClick: () => generateNcrCapaRegisterPdf(qmsData),
    },
    {
      title: "Management Review Summary",
      description: "QMS summary draft for leadership review, including supplier oversight, inspection backlog, NCRs, and CAPAs.",
      onClick: () => generateManagementReviewPdf(qmsData),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">ISO 13485 draft set.</span>{" "}
          Generate controlled draft PDFs from the live QMS records in this workspace. Use these as document-control starting points, then route them through your internal approval process before external use.
        </p>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {documentCards.map((card) => (
          <div key={card.title} className="glass-card rounded-xl p-5 border border-border/50 space-y-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{card.title}</div>
              <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
            </div>
            <Button size="sm" className="w-full gap-2" onClick={card.onClick}>
              <Printer className="h-3.5 w-3.5" /> Generate PDF
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
const DocumentsPage = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<any | null>(null);
  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();
  const { data: lots = [] } = useLots();
  const { data: inspections = [] } = useInspections();
  const { data: ncrs = [] } = useNCRs();
  const { data: capas = [] } = useCAPAs();
  const { data: documents = [] } = useDocuments();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      if (!user?.id) {
        throw new Error("You must be signed in to delete documents");
      }
      await deleteDocument(doc.id, user.id);
    },
    onSuccess: (_data, doc) => {
      if (viewingDoc?.id === doc.id) {
        setViewingDoc(null);
      }
      setDeletingDoc(null);
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Document deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const filtered = documents.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type.toLowerCase().includes(search.toLowerCase()) ||
      (d.file_name || '').toLowerCase().includes(search.toLowerCase());
    if (tab === 'all' || tab === 'packets' || tab === 'iso-drafts') return matchesSearch;
    return matchesSearch && d.status === tab;
  });

  const docsByStatus = (status: string) => documents.filter(d => d.status === status).length;

  return (
    <PageLayout title="Document Control" subtitle="SOPs, specifications, protocols & change history">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Documents', value: documents.length },
          { label: 'Processed', value: docsByStatus('processed'), color: 'text-status-success' },
          { label: 'Drafts / Uploaded', value: docsByStatus('draft'), color: 'text-status-warning' },
          { label: 'Flagged', value: docsByStatus('flagged'), color: 'text-status-danger' },
        ].map(m => (
          <div key={m.label} className="glass-card p-5">
            <div className={`text-3xl font-semibold ${'color' in m ? m.color : 'text-foreground'}`}>{m.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="processed">Processed</TabsTrigger>
          <TabsTrigger value="draft">Uploaded</TabsTrigger>
          <TabsTrigger value="flagged">Flagged</TabsTrigger>
          <TabsTrigger value="packets" className="gap-1"><FileText className="h-3.5 w-3.5" /> Inspector Packets</TabsTrigger>
          <TabsTrigger value="iso-drafts" className="gap-1"><FileText className="h-3.5 w-3.5" /> ISO Drafts</TabsTrigger>
        </TabsList>

        {/* Document list tabs */}
        {['all', 'processed', 'draft', 'flagged'].map(tabVal => (
          <TabsContent key={tabVal} value={tabVal} className="mt-4">
            <div className="glass-card overflow-hidden">
              {filtered.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">No documents found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Version</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Uploaded</TableHead>
                        <TableHead className="text-xs">Size</TableHead>
                        <TableHead className="text-xs">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map(doc => (
                        <TableRow
                          key={doc.id}
                          className="cursor-pointer hover:bg-accent/50 transition-colors"
                          onClick={() => setViewingDoc(doc)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-sm font-medium text-primary hover:underline">{doc.title}</div>
                                <div className="text-[10px] text-muted-foreground">{doc.file_name}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{typeLabels[doc.document_type] || doc.document_type}</Badge></TableCell>
                          <TableCell className="text-xs font-mono">v{doc.version || '1.0'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] capitalize ${statusClasses[doc.status] || ''}`}>{doc.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-xs">{doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1"
                                onClick={(e) => { e.stopPropagation(); setViewingDoc(doc); }}
                              >
                                <Eye className="h-3 w-3" /> View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-[10px] gap-1 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingDoc(doc);
                                }}
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>
        ))}

        <TabsContent value="packets" className="mt-4 space-y-4">
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">What is this?</span>{" "}
              Investigators often ask for structured supplier-control evidence.
              Generate one supplier inspection packet per outside company and add it to your inspection binder.
            </p>
          </div>
          <InspectorPackets suppliers={suppliers} parts={parts} />
        </TabsContent>

        <TabsContent value="iso-drafts" className="mt-4 space-y-4">
          <IsoDocumentDrafts
            suppliers={suppliers}
            parts={parts}
            lots={lots}
            inspections={inspections}
            ncrs={ncrs}
            capas={capas}
          />
        </TabsContent>
      </Tabs>

      {/* Document viewer dialog */}
      {viewingDoc && (
        <DocumentViewer doc={viewingDoc} open={!!viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

      <AlertDialog open={!!deletingDoc} onOpenChange={(open) => { if (!open) setDeletingDoc(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the document record, uploaded file, and generated vector chunks. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deletingDoc) return;
                deleteMutation.mutate(deletingDoc);
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
};

export default DocumentsPage;
