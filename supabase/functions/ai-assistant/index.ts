import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are Inspectra, a quality management assistant for ISO 13485 medical device companies.

You have access to tools that query the live QMS database. Use them to answer questions with real data.

OUTPUT FORMAT RULES (FOLLOW EXACTLY):

1. STRUCTURE EVERY RESPONSE WITH CLEAR SECTIONS using ## headers.
2. START with a short 1-2 sentence executive summary in **bold**.
3. USE TABLES for any data involving multiple items.
4. USE CALLOUT BLOCKS for critical findings:
> **CRITICAL**: [finding here]
> **WARNING**: [finding here]
> **OK**: [finding here]
5. KEEP PARAGRAPHS SHORT — max 2 sentences each. Use bullet points instead of long paragraphs.
6. USE STATUS LABELS consistently: CRITICAL, WARNING, PENDING, PASSED, REJECTED.
7. REFERENCE specific records by ID (e.g. LOT-4817, NCR-1042, CAPA-1044).
8. CITE ISO 13485 clauses and FDA 21 CFR 820 sections in parentheses.
9. END every response with a "## Next Steps" section with 2-3 prioritized actions.

DOMAIN EXPERTISE:
- Supplier qualification and risk assessment per ISO 13485 §7.4
- Incoming inspection analysis and anomaly detection
- Nonconformance report (NCR) generation and root cause analysis (§8.3)
- CAPA recommendations with effectiveness criteria (§8.5.2, §8.5.3)
- Lot traceability and recall impact analysis (§7.5.3)
- Compliance deadline tracking and audit preparation
- FDA 21 CFR 820 regulatory guidance

NEVER output a wall of text. ALWAYS break content into structured sections with tables, callouts, and bullet points.`;

const tools = [
  {
    type: "function",
    function: {
      name: "query_suppliers",
      description: "Query the suppliers table. Returns supplier name, code, status, risk_level, defect_rate, on_time_delivery, certification_type, certification_expiry, last_audit_date, next_audit_date, contact_email, address.",
      parameters: {
        type: "object",
        properties: {
          risk_level: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Filter by risk level" },
          status: { type: "string", description: "Filter by status (e.g. approved, pending, suspended)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_parts",
      description: "Query the parts table. Returns part name, part_number, risk_class, fda_clearance, unit_cost, description, and linked supplier name.",
      parameters: {
        type: "object",
        properties: {
          risk_class: { type: "string", description: "Filter by risk class (I, II, III)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_lots",
      description: "Query the lots table. Returns lot_number, status, quantity, received_date, expiration_date, inspection_status, and linked part/supplier names.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (e.g. quarantine, released, rejected)" },
          inspection_status: { type: "string", description: "Filter by inspection status (e.g. pending, passed, failed)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_inspections",
      description: "Query inspections table. Returns inspection_type, inspection_date, status, defects_found, sample_size, inspector_name, notes, and linked lot number.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (e.g. pending, passed, failed)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_ncrs",
      description: "Query NCRs (nonconformance reports). Returns ncr_number, title, description, severity, status, disposition, root_cause, corrective_action, and linked part/lot/supplier names.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (e.g. open, under_review, closed)" },
          severity: { type: "string", description: "Filter by severity (e.g. minor, major, critical)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_capas",
      description: "Query CAPAs (corrective/preventive actions). Returns capa_number, title, description, type, status, priority, root_cause, action_plan, assigned_to, due_date, completed_date, effectiveness_check, and linked NCR number.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status (e.g. open, in_progress, closed)" },
          priority: { type: "string", description: "Filter by priority (e.g. low, medium, high, critical)" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_documents",
      description: "Query documents table. Returns title, document_type, version, status, file_name, notes, and linked supplier/lot/NCR.",
      parameters: {
        type: "object",
        properties: {
          document_type: { type: "string", description: "Filter by type" },
          status: { type: "string", description: "Filter by status" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_qms_summary",
      description: "Get a high-level summary of the entire QMS: counts of suppliers, parts, lots, inspections, NCRs, CAPAs, plus key risk indicators.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
];

async function executeTool(supabase: any, name: string, args: any, userId: string): Promise<string> {
  try {
    switch (name) {
      case "query_suppliers": {
        let query = supabase.from("suppliers").select("*").eq("user_id", userId);
        if (args.risk_level) query = query.eq("risk_level", args.risk_level);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_parts": {
        let query = supabase.from("parts").select("*, suppliers(name)").eq("user_id", userId);
        if (args.risk_class) query = query.eq("risk_class", args.risk_class);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_lots": {
        let query = supabase.from("lots").select("*, parts(name, part_number), suppliers(name)").eq("user_id", userId);
        if (args.status) query = query.eq("status", args.status);
        if (args.inspection_status) query = query.eq("inspection_status", args.inspection_status);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_inspections": {
        let query = supabase.from("inspections").select("*, lots(lot_number)").eq("user_id", userId);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_ncrs": {
        let query = supabase.from("ncrs").select("*, parts(name), lots(lot_number), suppliers(name)").eq("user_id", userId);
        if (args.status) query = query.eq("status", args.status);
        if (args.severity) query = query.eq("severity", args.severity);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_capas": {
        let query = supabase.from("capas").select("*, ncrs(ncr_number)").eq("user_id", userId);
        if (args.status) query = query.eq("status", args.status);
        if (args.priority) query = query.eq("priority", args.priority);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "query_documents": {
        let query = supabase.from("documents").select("*, suppliers(name), lots(lot_number), ncrs(ncr_number)").eq("user_id", userId);
        if (args.document_type) query = query.eq("document_type", args.document_type);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(100);
        if (error) return JSON.stringify({ error: error.message });
        return JSON.stringify(data);
      }
      case "get_qms_summary": {
        const [suppliers, parts, lots, inspections, ncrs, capas] = await Promise.all([
          supabase.from("suppliers").select("id, risk_level, status", { count: "exact" }).eq("user_id", userId),
          supabase.from("parts").select("id", { count: "exact" }).eq("user_id", userId),
          supabase.from("lots").select("id, status, inspection_status", { count: "exact" }).eq("user_id", userId),
          supabase.from("inspections").select("id, status", { count: "exact" }).eq("user_id", userId),
          supabase.from("ncrs").select("id, status, severity", { count: "exact" }).eq("user_id", userId),
          supabase.from("capas").select("id, status, priority", { count: "exact" }).eq("user_id", userId),
        ]);
        return JSON.stringify({
          suppliers: { total: suppliers.count, high_risk: suppliers.data?.filter((s: any) => s.risk_level === "high" || s.risk_level === "critical").length },
          parts: { total: parts.count },
          lots: { total: lots.count, quarantine: lots.data?.filter((l: any) => l.status === "quarantine").length, pending_inspection: lots.data?.filter((l: any) => l.inspection_status === "pending").length },
          inspections: { total: inspections.count, pending: inspections.data?.filter((i: any) => i.status === "pending").length },
          ncrs: { total: ncrs.count, open: ncrs.data?.filter((n: any) => n.status === "open").length, critical: ncrs.data?.filter((n: any) => n.severity === "critical").length },
          capas: { total: capas.count, open: capas.data?.filter((c: any) => c.status !== "closed").length, overdue: capas.data?.filter((c: any) => c.due_date && new Date(c.due_date) < new Date() && c.status !== "closed").length },
        });
      }
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Tool execution failed" });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Extract user auth from the request to scope DB queries
    const authHeader = req.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create a client with the user's JWT to get their user_id
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    const userId = user?.id;

    // Use service role client for DB queries (bypasses RLS but we filter by user_id)
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const aiMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    // First call: let AI decide which tools to use
    const firstResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: aiMessages,
        tools,
        stream: false,
      }),
    });

    if (!firstResponse.ok) {
      const status = firstResponse.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await firstResponse.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const firstResult = await firstResponse.json();
    const choice = firstResult.choices?.[0];

    // If no tool calls, stream the response directly
    if (!choice?.message?.tool_calls || choice.message.tool_calls.length === 0) {
      // Re-do as streaming
      const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          stream: true,
        }),
      });
      return new Response(streamResponse.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Execute all tool calls in parallel
    const toolCalls = choice.message.tool_calls;
    const toolResults = await Promise.all(
      toolCalls.map(async (tc: any) => {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        const result = await executeTool(serviceClient, tc.function.name, args, userId || "");
        return {
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        };
      })
    );

    // Second call: stream final response with tool results
    const finalMessages = [
      ...aiMessages,
      choice.message,
      ...toolResults,
    ];

    const streamResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: finalMessages,
        stream: true,
      }),
    });

    if (!streamResponse.ok) {
      const t = await streamResponse.text();
      console.error("AI stream error:", streamResponse.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(streamResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
