import { useState, useRef } from "react";
import { PageLayout } from "@/components/PageLayout";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, AlertTriangle, Loader2, Link2, Brain, Search, AlertOctagon, Clock, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocuments, processUploadedDocument, uploadDocuments } from "@/lib/api";

const typeLabels: Record<string, string> = {
  certificate: 'Supplier Certificate',
  inspection_report: 'Inspection Report',
  batch_record: 'Batch/Lot Record',
  ncr_report: 'Nonconformance Report',
  sop: 'SOP',
  spec: 'Spec Sheet',
  capa_report: 'CAPA Report',
  other: 'Other',
};

const statusConfig: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  draft: { label: 'Uploaded', className: 'bg-status-info/10 text-status-info border-status-info/20', icon: CheckCircle },
  processing: { label: 'Processing', className: 'bg-status-warning/10 text-status-warning border-status-warning/20', icon: Loader2 },
  processed: { label: 'Processed', className: 'bg-status-success/10 text-status-success border-status-success/20', icon: CheckCircle },
  flagged: { label: 'Flagged', className: 'bg-status-danger/10 text-status-danger border-status-danger/20', icon: AlertTriangle },
};

const pipelineSteps = [
  { label: 'Extract Data', description: 'AI parses document into structured quality record', icon: Brain },
  { label: 'Link Records', description: 'Connect to supplier, part, inspection & product', icon: Link2 },
  { label: 'Flag Issues', description: 'Detect out-of-spec measurements', icon: AlertTriangle },
  { label: 'Auto-Generate NCR', description: 'Create nonconformance report if needed', icon: AlertOctagon },
  { label: 'Pattern Detection', description: 'Compare against past failures across lots', icon: Search },
  { label: 'CAPA Recommendation', description: 'Suggest root cause & corrective actions', icon: Brain },
  { label: 'Audit Trail', description: 'Generate audit-ready documentation', icon: Clock },
];

function useDocuments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => listDocuments(user!.id),
    enabled: !!user,
  });
}

const UploadPage = () => {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [processingResults, setProcessingResults] = useState<Record<string, any>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: documents = [] } = useDocuments();

  const detectType = (fileName: string): string => {
    const lower = fileName.toLowerCase();
    if (lower.includes('certificate') || lower.includes('cert') || lower.includes('coc')) return 'certificate';
    if (lower.includes('inspection')) return 'inspection_report';
    if (lower.includes('batch') || lower.includes('lot')) return 'batch_record';
    if (lower.includes('ncr') || lower.includes('nonconform')) return 'ncr_report';
    if (lower.includes('capa')) return 'capa_report';
    if (lower.includes('sop')) return 'sop';
    if (lower.includes('spec')) return 'spec';
    return 'other';
  };

  const processDocument = async (documentId: string) => {
    setProcessingIds(prev => new Set(prev).add(documentId));
    try {
      const data = await processUploadedDocument(documentId, user!.id);

      setProcessingResults(prev => ({ ...prev, [documentId]: data }));
      qc.invalidateQueries({ queryKey: ["documents"] });

      // Also invalidate related tables so they show new records
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      qc.invalidateQueries({ queryKey: ["parts"] });
      qc.invalidateQueries({ queryKey: ["lots"] });
      qc.invalidateQueries({ queryKey: ["inspections"] });
      qc.invalidateQueries({ queryKey: ["ncrs"] });
      qc.invalidateQueries({ queryKey: ["capas"] });

      const recordTypes = data?.created_records ? Object.keys(data.created_records) : [];
      toast({
        title: "Document processed",
        description: `Classified as ${typeLabels[data?.document_type] || data?.document_type}. ${
          recordTypes.length > 0
            ? `Created: ${recordTypes.join(", ")}`
            : "No new records created."
        }`,
      });
    } catch (e: any) {
      toast({ title: "Processing failed", description: e.message, variant: "destructive" });
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  const uploadFiles = async (files: FileList) => {
    if (!user) return;
    setUploading(true);
    try {
      const createdDocuments = await uploadDocuments(user.id, files);

      for (const docRecord of createdDocuments) {
        if (docRecord?.id) {
          processDocument(docRecord.id);
        }
      }
      qc.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "Documents uploaded — AI processing started" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <PageLayout title="Upload Documents" subtitle="Upload quality documents for AI extraction & linking">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />

      {/* AI Pipeline visualization */}
      <div className="glass-card rounded-xl p-5">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">Inspectra Processing Pipeline</div>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {pipelineSteps.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div key={i} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center text-center w-24">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-1">
                    <StepIcon className="h-4 w-4" />
                  </div>
                  <span className="text-[9px] font-semibold leading-tight">{step.label}</span>
                  <span className="text-[8px] text-muted-foreground leading-tight mt-0.5">{step.description}</span>
                </div>
                {i < pipelineSteps.length - 1 && <div className="h-px w-4 bg-border shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`glass-card rounded-xl border-2 border-dashed transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border/50'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
            {uploading ? <Loader2 className="h-7 w-7 animate-spin" /> : <Upload className="h-7 w-7" />}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{uploading ? "Uploading..." : "Upload Quality Documents"}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Drag & drop or click to upload. AI will automatically read, classify, and populate your QMS records.
          </p>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            {Object.values(typeLabels).map(label => (
              <Badge key={label} variant="outline" className="text-[10px]">{label}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Recent uploads from DB */}
      <div className="glass-card rounded-xl">
        <div className="border-b border-border/50 px-5 py-4">
          <h3 className="text-sm font-semibold">Recent Uploads</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{documents.length} documents in storage</p>
        </div>
        <div className="divide-y divide-border/30">
          {documents.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</div>
          )}
          {documents.map(doc => {
            const isProcessing = processingIds.has(doc.id);
            const result = processingResults[doc.id];
            const sc = isProcessing
              ? statusConfig.processing
              : statusConfig[doc.status] || statusConfig.draft;
            const StatusIcon = sc.icon;

            return (
              <div key={doc.id} className="px-5 py-3.5 hover:bg-accent/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/50 text-muted-foreground shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{doc.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{typeLabels[doc.document_type] || doc.document_type}</span>
                      <span className="text-[10px] text-muted-foreground">•</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleDateString()}</span>
                      {doc.file_size && <><span className="text-[10px] text-muted-foreground">•</span><span className="text-[10px] text-muted-foreground">{(doc.file_size / 1024).toFixed(0)} KB</span></>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {doc.status === "draft" && !isProcessing && (
                      <button
                        onClick={(e) => { e.stopPropagation(); processDocument(doc.id); }}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Sparkles className="h-3 w-3" /> Process
                      </button>
                    )}
                    <Badge variant="outline" className={`text-[10px] gap-1 ${sc.className}`}>
                      <StatusIcon className={`h-3 w-3 ${isProcessing ? 'animate-spin' : ''}`} /> {isProcessing ? 'Processing...' : sc.label}
                    </Badge>
                  </div>
                </div>

                {/* Show processing result summary */}
                {(result || (doc.status === "processed" && doc.extracted_data)) && (
                  <div className="mt-2 ml-12 p-2.5 rounded-lg bg-accent/30 border border-border/30">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-semibold text-primary">AI Analysis</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {result?.summary || (doc.extracted_data as any)?.summary || doc.notes}
                    </p>
                    {(result?.created_records || (doc.extracted_data as any)?.supplier || (doc.extracted_data as any)?.inspection) && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {Object.keys(result?.created_records || {}).map(key => (
                          <Badge key={key} variant="outline" className="text-[9px] bg-status-success/10 text-status-success border-status-success/20">
                            {key} created
                          </Badge>
                        ))}
                        {!result && (doc.extracted_data as any)?.supplier?.name && (
                          <Badge variant="outline" className="text-[9px] bg-status-info/10 text-status-info border-status-info/20">
                            Supplier: {(doc.extracted_data as any).supplier.name}
                          </Badge>
                        )}
                        {!result && (doc.extracted_data as any)?.part?.part_number && (
                          <Badge variant="outline" className="text-[9px] bg-status-info/10 text-status-info border-status-info/20">
                            Part: {(doc.extracted_data as any).part.part_number}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
};

export default UploadPage;
