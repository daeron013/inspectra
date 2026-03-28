import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { FileText, Search, Eye, Printer, ExternalLink, Download, X } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSuppliers, useParts } from "@/hooks/useQMS";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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

function useDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

function getFileUrl(filePath: string) {
  const { data } = supabase.storage.from("documents").getPublicUrl(filePath);
  return data.publicUrl;
}

async function getSignedUrl(filePath: string) {
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ─── Document Viewer Dialog ───────────────────────────────
function DocumentViewer({ doc, open, onClose }: { doc: any; open: boolean; onClose: () => void }) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFile = async () => {
    if (!doc?.file_path) return;
    setLoading(true);
    try {
      const url = await getSignedUrl(doc.file_path);
      setFileUrl(url);
    } catch {
      setFileUrl(null);
    } finally {
      setLoading(false);
    }
  };

  // Load when opened
  if (open && !fileUrl && !loading && doc?.file_path) {
    loadFile();
  }

  const isPdf = doc?.file_name?.toLowerCase().endsWith('.pdf');
  const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(doc?.file_name || '');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); setFileUrl(null); } }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
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
        </div>
        <div className="flex-1 min-h-[400px] rounded-lg border border-border overflow-hidden bg-accent/20">
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
              <p className="text-[10px] text-muted-foreground">Regulator packet · {supplier.name}</p>
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
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Certificates We Keep</div>
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
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Last Check-In</div>
              <p className="text-xs text-foreground">
                {daysSinceAudit !== null ? `${daysSinceAudit} days ago` : "No audit on file"}
                {daysSinceAudit !== null && daysSinceAudit > 90 && (
                  <span className="text-status-warning text-[10px] ml-1">— follow-up overdue</span>
                )}
              </p>
            </div>
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-primary mb-1">Our Part Numbers From Them</div>
              <p className="text-xs text-foreground">{supplierParts.length > 0 ? supplierParts.map((p: any) => `${p.part_number} ${p.name}`).join(", ") : "None linked"}</p>
            </div>
            <Button size="sm" className="w-full mt-2 h-8 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="h-3 w-3" /> Print or save PDF
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

// ─── Main Page ────────────────────────────────────────────
const DocumentsPage = () => {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('all');
  const [viewingDoc, setViewingDoc] = useState<any | null>(null);
  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();
  const { data: documents = [] } = useDocuments();

  const filtered = documents.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.document_type.toLowerCase().includes(search.toLowerCase()) ||
      (d.file_name || '').toLowerCase().includes(search.toLowerCase());
    if (tab === 'all' || tab === 'packets') return matchesSearch;
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
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-[10px] gap-1"
                              onClick={(e) => { e.stopPropagation(); setViewingDoc(doc); }}
                            >
                              <Eye className="h-3 w-3" /> View
                            </Button>
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
              Investigators often ask for a short summary of each outside company that supplies your product.
              Print one packet per supplier and add it to your inspection binder.
            </p>
          </div>
          <InspectorPackets suppliers={suppliers} parts={parts} />
        </TabsContent>
      </Tabs>

      {/* Document viewer dialog */}
      {viewingDoc && (
        <DocumentViewer doc={viewingDoc} open={!!viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </PageLayout>
  );
};

export default DocumentsPage;
