import { listDocuments, listEntity } from "./qms.js";

const SYSTEM_PROMPT = `You are Inspectra, a quality management assistant for ISO 13485 medical device companies.

You answer using the live QMS data provided to you from MongoDB Atlas.

STYLE RULES:
1. Be concise by default.
2. Answer in 2-5 sentences unless the user explicitly asks for detail.
3. Use short bullets only when they make the answer clearer.
4. Do not use markdown headers unless the user asks for a report or audit summary.
5. Do not use tables unless the user asks for a comparison or the data would be hard to read otherwise.
6. Reference specific records or dates only when relevant to the answer.
7. If the data is insufficient, say so directly in one short sentence.
8. End with a brief recommendation only when useful.`;

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
