import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Bot, User, Loader2, Search,  AlertTriangle,
  FileText, ShieldCheck, Brain, Printer, AlertOctagon, Download, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSuppliers, useParts } from "@/hooks/useQMS";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/hooks/useAuth";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_API_BASE_URL || ""}/api/assistant`;

// ─── PDF Export ───────────────────────────────────────────
async function exportResponseAsPDF(content: string, index: number) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Inspectra — Quality Report", margin, 13);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleString(), pageWidth - margin, 13, { align: "right" });

  y = 28;
  doc.setTextColor(30, 30, 30);

  // Parse markdown-ish content into lines
  const lines = content.split("\n");
  for (const line of lines) {
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }

    const trimmed = line.trim();
    if (!trimmed) { y += 3; continue; }

    if (trimmed.startsWith("## ")) {
      y += 4;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      const wrapped = doc.splitTextToSize(trimmed.replace(/^##\s*/, ""), maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5 + 2;
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 3;
    } else if (trimmed.startsWith("### ")) {
      y += 2;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(60, 60, 60);
      const wrapped = doc.splitTextToSize(trimmed.replace(/^###\s*/, ""), maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 2;
    } else if (trimmed.startsWith("|")) {
      // Table row
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const cells = trimmed.split("|").filter(c => c.trim()).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) continue; // separator row
      const colW = maxWidth / Math.max(cells.length, 1);
      cells.forEach((cell, ci) => {
        const clean = cell.replace(/\*\*/g, "");
        const truncated = doc.splitTextToSize(clean, colW - 2);
        doc.text(truncated[0] || "", margin + ci * colW + 1, y);
      });
      y += 4;
    } else if (trimmed.startsWith("> ")) {
      doc.setFillColor(240, 245, 255);
      const text = trimmed.replace(/^>\s*/, "").replace(/\*\*/g, "");
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      const wrapped = doc.splitTextToSize(text, maxWidth - 8);
      doc.rect(margin, y - 3, maxWidth, wrapped.length * 4 + 4, "F");
      doc.setTextColor(30, 60, 120);
      doc.text(wrapped, margin + 4, y);
      y += wrapped.length * 4 + 4;
      doc.setFont("helvetica", "normal");
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed)) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const text = trimmed.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, "").replace(/\*\*/g, "");
      const wrapped = doc.splitTextToSize(`• ${text}`, maxWidth - 4);
      doc.text(wrapped, margin + 2, y);
      y += wrapped.length * 4 + 1;
    } else {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);
      const text = trimmed.replace(/\*\*/g, "");
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4 + 1;
    }
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(`Inspectra Report — Page ${i} of ${pageCount}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 8, { align: "center" });
  }

  doc.save(`inspectra-report-${index + 1}.pdf`);
}

// ─── Clickable Action Extractor ──────────────────────────
function extractActions(content: string): string[] {
  const actions: string[] = [];
  const lines = content.split("\n");
  let inNextSteps = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s*Next Steps/i.test(trimmed)) {
      inNextSteps = true;
      continue;
    }
    if (inNextSteps && trimmed.startsWith("##")) break;
    
    if (inNextSteps) {
      // Table rows with actions
      if (trimmed.startsWith("|") && !trimmed.includes("---")) {
        const cells = trimmed.split("|").filter(c => c.trim());
        if (cells.length >= 2) {
          const actionText = cells[1]?.trim().replace(/\*\*/g, "") || cells[0]?.trim().replace(/\*\*/g, "");
          if (actionText && actionText.toLowerCase() !== "action" && actionText.toLowerCase() !== "#") {
            actions.push(actionText);
          }
        }
      }
      // Numbered or bulleted items
      if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed.replace(/^\d+\.\s*/, "").replace(/^[-*]\s*/, "").replace(/\*\*/g, "").trim();
        if (text.length > 5) actions.push(text);
      }
    }
    
    // Also extract action items from tables with "Action" header
    if (trimmed.startsWith("|") && /action/i.test(trimmed) && /priority|deadline|owner/i.test(trimmed)) {
      // This is a header row of an action table — next rows are actions
      inNextSteps = true;
    }
  }
  
  return actions.slice(0, 5);
}

// ─── Quick Actions ────────────────────────────────────────
const quickActions = [
  { label: "Inspection lots", icon: Search, prompt: "Review all lots with pending inspections. For each lot, show the lot number, part, supplier, quantity, and current inspection status. Flag any that are overdue or at risk." },
  { label: "Supplier status", icon: ShieldCheck, prompt: "Give me a complete supplier status report. For each supplier show: name, risk level, defect rate trend, certification expiry, days since last audit, and open NCRs. Highlight any that need requalification or are at risk." },
  { label: "Inspection → NCR → CAPA", icon: AlertOctagon, prompt: "From inspection and lot data, find anomalies that warrant opening an NCR. For each candidate, draft: title, severity, description, suggested disposition, and root cause hypothesis. Then review NCR history for recurring patterns (supplier, part, failure mode) and recommend CAPAs where the same issue repeats." },
  { label: "Open NCRs", icon: AlertTriangle, prompt: "List all open NCRs with their severity, linked parts, lots, and suppliers. For each, suggest next steps and disposition recommendations." },
  { label: "Audit readiness", icon: FileText, prompt: "Assess our current audit readiness for an ISO 13485 FDA inspection. Check: 1) All suppliers have current certifications, 2) All lots have completed inspections, 3) All NCRs have dispositions, 4) All CAPAs have action plans, 5) No overdue requalifications. Give a readiness score and list gaps." },
  { label: "Compliance workspace", icon: Brain, prompt: "Generate a compliance workspace summary with: 1) Inspector packets overview for each supplier, 2) Parts we can buy that are FDA approved, 3) Supplies on the shelf with expiration status, 4) Any recalls or affected finished products." },
];

// ─── Inspector Packet Component ───────────────────────────
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
              <p className="text-xs text-foreground">
                {supplierParts.length > 0 ? supplierParts.map((p: any) => p.name).join(", ") : "No parts currently linked"}
              </p>
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
              <p className="text-xs text-foreground">
                {supplierParts.length > 0 ? supplierParts.map((p: any) => `${p.part_number} ${p.name}`).join(", ") : "None linked"}
              </p>
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
const AIAssistantPage = () => {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const initialPromptSent = useRef(false);
  const { user } = useAuth();

  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: allMessages, userId: user?.id }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantSoFar += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
                }
                return [...prev, { role: "assistant", content: assistantSoFar }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading, toast, user?.id]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && !initialPromptSent.current && suppliers.length >= 0) {
      initialPromptSent.current = true;
      setTimeout(() => sendMessage(prompt), 500);
    }
  }, [searchParams, sendMessage, suppliers]);

  return (
    <PageLayout title="AI Assistant" subtitle="Ask Inspectra — powered by your live QMS data">
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Bot className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Inspectra AI Assistant</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                  Connected to your live QMS database. The AI queries your data directly using tool calling.
                  Ask anything or use the quick actions below.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full">
                {[
                  "Which lots failed inspection and what should we do?",
                  "Is MedTech Inc a reliable supplier? Show me the data.",
                  "From the latest inspections, what should become an NCR and why?",
                  "What do I need to prepare for an FDA audit next week?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    className="text-left text-xs p-3 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const actions = msg.role === "assistant" && !isLoading ? extractActions(msg.content) : [];
            return (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                <div className={`rounded-xl px-5 py-4 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground max-w-[75%]" : "glass-card max-w-[95%] w-full"}`}>
                  {msg.role === "assistant" ? (
                    <div>
                      <div className="ai-response prose prose-sm max-w-none dark:prose-invert
                        [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:pb-1.5 [&_h2]:border-b [&_h2]:border-border/50
                        [&_h3]:text-xs [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-widest [&_h3]:text-muted-foreground [&_h3]:mt-4 [&_h3]:mb-2
                        [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_table]:my-3 [&_table]:rounded-lg [&_table]:border [&_table]:border-border/50 [&_table]:overflow-hidden
                        [&_thead]:bg-accent/80
                        [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground [&_th]:border-b-2 [&_th]:border-border/60 [&_th]:whitespace-nowrap
                        [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/30 [&_td]:text-foreground
                        [&_tr:last-child_td]:border-b-0 [&_tr:hover]:bg-accent/20 [&_tbody_tr:nth-child(even)]:bg-accent/10
                        [&_blockquote]:my-2 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:rounded-lg [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:bg-accent/30 [&_blockquote]:not-italic [&_blockquote_p]:my-0.5
                        [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:my-2 [&_ol]:space-y-1 [&_li]:my-0 [&_li]:leading-relaxed
                        [&_p]:my-2 [&_p]:leading-relaxed
                        [&_strong]:text-foreground [&_strong]:font-semibold
                        [&_code]:bg-accent/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono
                        [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
                        [&_hr]:my-4 [&_hr]:border-border/40
                      ">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>

                      {actions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/40">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Quick Actions — Click to execute</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {actions.map((action, ai) => (
                              <Button
                                key={ai}
                                variant="outline"
                                size="sm"
                                className="h-auto py-1.5 px-3 text-[11px] text-left whitespace-normal gap-1.5 border-primary/30 hover:bg-primary/10 hover:border-primary/60 transition-all"
                                onClick={() => sendMessage(`Execute this action and provide detailed guidance: ${action}`)}
                                disabled={isLoading}
                              >
                                <Zap className="h-3 w-3 shrink-0 text-primary" />
                                {action}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {!isLoading && (
                        <div className="mt-3 pt-2 border-t border-border/30 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => exportResponseAsPDF(msg.content, i)}
                          >
                            <Download className="h-3 w-3" /> Export as PDF
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-foreground">
                    <User className="h-4 w-4" />
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </div>
              <div className="glass-card rounded-xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="border-t border-border/50 pt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] gap-1"
                onClick={() => sendMessage(action.prompt)}
                disabled={isLoading}
              >
                <action.icon className="h-3 w-3" /> {action.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask anything — 'which lots failed inspection?' or 'is MedTech Inc reliable?'..."
              className="min-h-[44px] max-h-32 resize-none text-sm"
              rows={1}
            />
            <Button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} size="icon" className="shrink-0 h-11 w-11">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AIAssistantPage;
