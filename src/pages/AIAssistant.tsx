import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Bot, User, Loader2, Search,
  AlertOctagon, Download, Zap,
  Play, Package, ClipboardCheck, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSuppliers, useParts, useInspections, useRunCapaAgent } from "@/hooks/useQMS";
import { triggerInspectionAgent, runSupplierAgent, runComplianceAgent } from "@/lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Schema } from "hast-util-sanitize";

/** Allow limited inline HTML from the model (callout boxes); `style` only on safe wrappers. */
const assistantMarkdownSchema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), "style"],
    p: [...(defaultSchema.attributes?.p ?? []), "style"],
    span: [...(defaultSchema.attributes?.span ?? []), "style"],
  },
};

const assistantRehypePlugins = [rehypeRaw, [rehypeSanitize, assistantMarkdownSchema] as const];

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
    if (/^##\s*(Suggested\s+)?Next Steps/i.test(trimmed)) {
      inNextSteps = true;
      continue;
    }
    if (inNextSteps && trimmed.startsWith("##")) break;

    if (inNextSteps) {
      // Bulleted or numbered items
      if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const text = trimmed
          .replace(/^\d+\.\s*/, "")
          .replace(/^[-*]\s*/, "")
          .replace(/\*\*/g, "")
          .replace(/[✅⚠️❌🔵]/g, "")
          .trim();
        if (text.length > 5) actions.push(text);
      }
      // Table rows
      if (trimmed.startsWith("|") && !trimmed.includes("---")) {
        const cells = trimmed.split("|").filter(c => c.trim());
        if (cells.length >= 2) {
          const actionText = cells[1]?.trim().replace(/\*\*/g, "") || cells[0]?.trim().replace(/\*\*/g, "");
          if (actionText && actionText.toLowerCase() !== "action" && actionText.toLowerCase() !== "#") {
            actions.push(actionText);
          }
        }
      }
    }
  }

  return actions.slice(0, 4);
}

// Strip the "## Suggested Next Steps" section from display content
function stripNextSteps(content: string): string {
  return content.replace(/\n*##\s*(Suggested\s+)?Next Steps[\s\S]*$/i, "").trim();
}


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

// ─── Agent definitions ────────────────────────────────────
type AgentId = "inspection" | "capa" | "supplier" | "compliance";

const AGENTS: { id: AgentId; label: string; description: string; icon: React.ElementType; prompts: string[] }[] = [
  {
    id: "inspection",
    label: "Inspection Agent",
    description: "Analyzes incoming inspections, flags anomalies, creates NCRs",
    icon: Search,
    prompts: [
      "Show all lots with failed or pending inspections and their defect rates.",
      "Which inspections triggered an NCR in the last 30 days?",
      "What is the defect rate trend across recent inspections?",
      "Are there any lots currently on hold pending full inspection?",
    ],
  },
  {
    id: "capa",
    label: "CAPA Agent",
    description: "Detects recurring NCR patterns and opens corrective actions",
    icon: AlertOctagon,
    prompts: [
      "List all open CAPAs and their current status.",
      "Which suppliers have recurring NCR patterns that need a CAPA?",
      "Show CAPAs that are past their due date.",
      "What recurring failure modes have triggered CAPAs in the last 90 days?",
    ],
  },
  {
    id: "supplier",
    label: "Supplier Agent",
    description: "Scores supplier risk, tracks certifications and audit status",
    icon: Package,
    prompts: [
      "Which suppliers are flagged as at-risk and why?",
      "List suppliers with certifications expiring in the next 60 days.",
      "Which suppliers are overdue for a requalification audit?",
      "Show me the defect rate trend per supplier over the last 90 days.",
    ],
  },
  {
    id: "compliance",
    label: "Compliance Agent",
    description: "Assesses ISO 13485 and FDA readiness across the QMS",
    icon: ClipboardCheck,
    prompts: [
      "What is our current ISO 13485 audit readiness score?",
      "Are there any open NCRs without a disposition that could fail an FDA inspection?",
      "Which parts or suppliers pose the highest regulatory risk right now?",
      "Generate a compliance gap summary across all QMS domains.",
    ],
  },
];

// ─── Main Page ────────────────────────────────────────────
const AIAssistantPage = () => {
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<AgentId | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const initialPromptSent = useRef(false);
  const { getAccessToken, user } = useAuth();

  const { data: suppliers = [] } = useSuppliers();
  const { data: parts = [] } = useParts();
  const { data: inspections = [] } = useInspections();
  const [selectedInspectionId, setSelectedInspectionId] = useState<string>("");
  const [agentRunning, setAgentRunning] = useState<AgentId | null>(null);
  const runCapaAgentMutation = useRunCapaAgent();
  const BASE = import.meta.env.VITE_API_BASE_URL || "";

  // Load persisted history on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        const resp = await fetch(`${BASE}/api/chat/history`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.messages?.length) setMessages(data.messages);
        }
      } catch { /* silent — non-critical */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save history whenever messages change (debounced 1 s)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!messages.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const token = await getAccessToken();
        await fetch(`${BASE}/api/chat/history`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ messages }),
        });
      } catch { /* silent */ }
    }, 1000);
  }, [messages]);

  async function clearHistory() {
    try {
      const token = await getAccessToken();
      await fetch(`${BASE}/api/chat/history`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch { /* silent */ }
    setMessages([]);
  }

  function formatAgentResult(agentName: string, result: any): string {
    const lines: string[] = [`**${agentName} completed.**`, ""];
    if (result?.summary) lines.push(result.summary, "");
    if (result?.capa_created) {
      const c = result.capa_created;
      lines.push(`- CAPA created: **${c.capa_number || c._id}** — ${c.title || ""}`);
    }
    if (result?.ncr_created) {
      const n = result.ncr_created;
      lines.push(`- NCR created: **${n.ncr_number || n._id}** — ${n.title || ""}`);
    }
    if (result?.action_taken) lines.push(`- Action: ${result.action_taken}`);
    if (result?.confidence !== undefined) lines.push(`- Confidence: ${Math.round(result.confidence * 100)}%`);
    if (result?.requires_human_review) lines.push("- **Human review required.**");
    return lines.join("\n").trim();
  }

  async function triggerAgent(id: AgentId) {
    if (agentRunning) return;
    const agentDef = AGENTS.find((a) => a.id === id)!;
    setAgentRunning(id);
    setMessages((prev) => [...prev, { role: "assistant", content: `Running ${agentDef.label}...` }]);

    try {
      let result: any;
      if (id === "inspection") {
        const inspId = selectedInspectionId || inspections[0]?._id || inspections[0]?.id;
        if (!inspId) throw new Error("No inspections available to run against.");
        result = await triggerInspectionAgent(inspId, user!.id);
      } else if (id === "capa") {
        result = await new Promise((resolve, reject) => {
          runCapaAgentMutation.mutate(undefined, { onSuccess: resolve, onError: reject });
        });
      } else if (id === "supplier") {
        result = await runSupplierAgent(user!.id);
      } else {
        result = await runComplianceAgent(user!.id);
      }
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: formatAgentResult(agentDef.label, result) },
      ]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: `${agentDef.label} failed: ${e.message}` },
      ]);
    } finally {
      setAgentRunning(null);
    }
  }

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
      const token = await getAccessToken();
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: allMessages }),
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
  }, [getAccessToken, isLoading, messages, toast]);

  useEffect(() => {
    const prompt = searchParams.get("prompt");
    if (prompt && !initialPromptSent.current && suppliers.length >= 0) {
      initialPromptSent.current = true;
      setTimeout(() => sendMessage(prompt), 500);
    }
  }, [searchParams, sendMessage, suppliers]);

  const activeAgentDef = AGENTS.find((a) => a.id === activeAgent);
  const currentPrompts = activeAgentDef?.prompts ?? [
    "Which lots failed inspection and what should we do?",
    "Suggest alternative suppliers for our highest-risk parts.",
    "From the latest inspections, what should become an NCR and why?",
    "What do I need to prepare for an FDA audit next week?",
  ];

  return (
    <PageLayout title="AI Assistant" subtitle="Ask Inspectra — powered by your live QMS data">
      <div className="flex flex-col h-[calc(100vh-12rem)] -mb-6">


        {/* Agent panel — top */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {AGENTS.map((agent) => {
            const Icon = agent.icon;
            const isActive = activeAgent === agent.id;
            const isRunning = agentRunning === agent.id;
            return (
              <div
                key={agent.id}
                onClick={() => setActiveAgent(isActive ? null : agent.id)}
                className={`relative flex flex-col gap-1.5 rounded-xl border p-3 cursor-pointer transition-all select-none
                  ${isActive ? "border-primary/60 bg-primary/8 shadow-sm" : "border-border/50 bg-card hover:border-border hover:bg-accent/30"}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-[11px] font-semibold ${isActive ? "text-primary" : "text-foreground"}`}>{agent.label}</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); triggerAgent(agent.id); }}
                    disabled={!!agentRunning}
                    className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40
                      ${isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                  >
                    {isRunning ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                    Run
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground leading-snug">{agent.description}</p>
                {agent.id === "inspection" && isActive && (
                  <select
                    className="mt-0.5 w-full rounded border border-border/50 bg-background px-2 py-1 text-[10px] text-foreground outline-none"
                    value={selectedInspectionId}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setSelectedInspectionId(e.target.value)}
                  >
                    <option value="">{inspections.length ? `Latest — ${inspections[0]?.lot_number || inspections[0]?._id?.slice(-6)}` : "No inspections"}</option>
                    {inspections.slice(0, 20).map((ins: any) => (
                      <option key={ins._id || ins.id} value={ins._id || ins.id}>
                        {ins.lot_number || ins._id?.slice(-6)}{ins.part_name ? ` — ${ins.part_name}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            );
          })}
        </div>

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
                  "Suggest qualified ISO 13485 suppliers for PEEK spinal implants.",
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
            const isLastMsg = i === messages.length - 1;
            const isStreaming = isLastMsg && isLoading;
            const actions = msg.role === "assistant" && !isStreaming ? extractActions(msg.content) : [];
            const displayContent = msg.role === "assistant" ? stripNextSteps(msg.content) : msg.content;
            return (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-1">
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
                          [&_table]:w-full [&_table]:text-xs [&_table]:my-4 [&_table]:border-separate [&_table]:border-spacing-0 [&_table]:rounded-xl [&_table]:overflow-hidden [&_table]:border [&_table]:border-border/60 [&_table]:shadow-sm
                          [&_thead_tr]:bg-muted/60
                          [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground/80 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wide [&_th]:border-b [&_th]:border-border/60
                          [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/30 [&_td]:text-foreground [&_td]:align-middle
                          [&_tbody_tr:last-child_td]:border-b-0
                          [&_tbody_tr:nth-child(even)]:bg-muted/20
                          [&_tbody_tr:hover]:bg-primary/5
                          [&_blockquote]:my-2 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:rounded-lg [&_blockquote]:border-l-4 [&_blockquote]:border-primary/50 [&_blockquote]:bg-accent/30 [&_blockquote]:not-italic [&_blockquote_p]:my-0.5
                          [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1 [&_li]:my-0 [&_li]:leading-relaxed
                          [&_p]:my-2 [&_p]:leading-relaxed
                          [&_strong]:text-foreground [&_strong]:font-semibold
                          [&_code]:bg-accent/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_code]:font-mono
                          [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2
                          [&_hr]:my-4 [&_hr]:border-border/40
                        ">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={assistantRehypePlugins}>
                            {displayContent}
                          </ReactMarkdown>
                        </div>

                        {actions.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-border/40 space-y-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Suggested next steps</p>
                            {actions.map((action, ai) => (
                              <button
                                key={ai}
                                onClick={() => sendMessage(action)}
                                disabled={isLoading}
                                className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-background/60 px-3.5 py-2.5 text-left text-xs text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm active:scale-[0.99] disabled:opacity-40"
                              >
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                                  {ai + 1}
                                </span>
                                <span className="flex-1 leading-snug">{action}</span>
                                <Send className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                              </button>
                            ))}
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

        {/* Contextual quick prompts */}
        <div className="border-t border-border/50 pt-3 space-y-2 pb-0">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
            {currentPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="shrink-0 text-[11px] rounded-lg border border-border/50 bg-card px-3 py-1.5 text-muted-foreground hover:text-foreground hover:border-border hover:bg-accent/40 transition-colors disabled:opacity-40 whitespace-nowrap"
              >
                {prompt}
              </button>
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
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="shrink-0 flex items-center justify-center h-11 w-11 rounded-md text-muted-foreground hover:text-destructive transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
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
