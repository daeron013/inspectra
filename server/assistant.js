import { listDocuments, listEntity } from "./qms.js";

const SYSTEM_PROMPT = `You are Inspectra, a quality management assistant for ISO 13485 medical device companies.

You answer using the live QMS data provided to you from MongoDB Atlas. You also have access to Google Search for real-world research.

WHEN TO USE GOOGLE SEARCH:
- Whenever the user asks about a specific company by name (e.g. "tell me about Acme Medical", "is XYZ Corp reliable") — search for their profile, certifications, regulatory history, and any FDA warning letters or recalls.
- Whenever the user asks for supplier suggestions, sourcing recommendations, or alternatives to a current supplier — search for qualified medical device suppliers in that category.
- For any question about industry standards, regulatory guidance, or market data that is not answerable from QMS records alone.
- Always clearly label web-sourced information as "From web search:" so the user knows what came from their QMS vs. the internet.

FORMATTING RULES:
1. Never use emojis. Use plain text only.
2. Bold supplier names, part numbers, lot IDs, NCR/CAPA numbers, and key metrics using **bold**.
3. Break up responses into short bullets. Each bullet covers exactly one fact, status, or action — never combine two ideas in one sentence. Prose paragraphs are only for a single-sentence summary before the bullets.
4. Use tables for comparisons of 3+ items across multiple attributes; use numbered steps for procedures.
5. Use ## headers only for multi-section responses (full reports, audits, compliance summaries).
6. Keep answers tight. For simple questions: 1 summary sentence + 2–5 bullets. For reports: use headers + bullets per section.
7. Always pair IDs and codes with their human-readable name. Never show a code alone — always write it as "LOT-2026-1087 (PEEK Spinal Cage)", "NCR-E9F2459A (surface defect — PrecisionMed Plastics)", "S-203 (PrecisionMed Plastics)", etc. The name should follow the ID in parentheses.
8. If data is insufficient, say so in one sentence.

SUGGESTED NEXT STEPS — ALWAYS REQUIRED:
End every single response with this section (no exceptions):

## Suggested Next Steps
- [specific follow-up action or question, under 12 words]
- [specific follow-up action or question, under 12 words]
- [specific follow-up action or question, under 12 words]

Rules for next steps:
- Make them specific to the data you just showed (e.g. "Review MedTech Inc open NCRs" not "Review your suppliers")
- Each step should be something useful the user can do RIGHT NOW
- Include 2–4 steps, never more than 4
- Do NOT add any text after the Suggested Next Steps section`;

function requireGeminiApiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return apiKey;
}

function geminiModel() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}

function buildConversation(messages) {
  return messages
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n\n");
}

function trimRecords(records, limit = 25) {
  return records.slice(0, limit);
}

async function buildAssistantContext(db, userId) {
  const [suppliers, parts, lots, inspections, ncrs, capas, documents] = await Promise.all([
    listEntity(db, "suppliers", userId),
    listEntity(db, "parts", userId),
    listEntity(db, "lots", userId),
    listEntity(db, "inspections", userId),
    listEntity(db, "ncrs", userId),
    listEntity(db, "capas", userId),
    listDocuments(db, userId),
  ]);

  const summary = {
    suppliers: suppliers.length,
    parts: parts.length,
    lots: lots.length,
    inspections: inspections.length,
    ncrs: ncrs.length,
    capas: capas.length,
    documents: documents.length,
    pending_inspections: lots.filter((item) => item.inspection_status === "pending").length,
    open_ncrs: ncrs.filter((item) => item.status === "open").length,
    open_capas: capas.filter((item) => item.status !== "closed").length,
  };

  return JSON.stringify(
    {
      summary,
      suppliers: trimRecords(suppliers),
      parts: trimRecords(parts),
      lots: trimRecords(lots),
      inspections: trimRecords(inspections),
      ncrs: trimRecords(ncrs),
      capas: trimRecords(capas),
      documents: trimRecords(documents),
    },
    null,
    2,
  );
}

function extractGeminiText(json) {
  return (
    json.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || "")
      .join("")
      .trim() || ""
  );
}

export async function generateAssistantResponse(db, userId, messages) {
  const apiKey = requireGeminiApiKey();
  const model = geminiModel();
  const context = await buildAssistantContext(db, userId);
  const prompt = [
    "Use the following live QMS data from MongoDB Atlas to answer the user's request.",
    "If the data is insufficient, state that clearly.",
    "",
    "QMS Data:",
    context,
    "",
    "Conversation:",
    buildConversation(messages),
  ].join("\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [{ google_search: {} }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini assistant request failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const text = extractGeminiText(json);
  if (!text) {
    throw new Error("Gemini assistant response was empty");
  }
  return text;
}

export function streamAssistantText(text, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const payload = JSON.stringify({
    choices: [
      {
        delta: {
          content: text,
        },
      },
    ],
  });

  res.write(`data: ${payload}\n\n`);
  res.write("data: [DONE]\n\n");
  res.end();
}
