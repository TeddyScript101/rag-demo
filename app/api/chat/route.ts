import Groq from "groq-sdk";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
// Use /lib path to skip pdf-parse's test runner that loads on index.js import
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let message: string, mode: string;
  try {
    ({ message, mode } = await req.json());
  } catch {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!process.env.GROQ_API_KEY) {
    return new Response("api_key_missing", { status: 503 });
  }

  // ─── STEP 1: RETRIEVAL ────────────────────────────────────────────────────
  // Read all .md and .pdf files from /data as our "knowledge base".
  //
  // This is "in-context retrieval": the entire corpus is injected into the prompt.
  // Works well for small document sets (< ~50 pages total).
  //
  // At scale, this step would instead:
  //   1. Embed the user query → query vector
  //   2. Run similarity search against a vector DB (Pinecone, pgvector, etc.)
  //   3. Inject only the top-k most relevant chunks
  // That avoids context window limits and reduces cost/latency.
  const dataDir = path.join(process.cwd(), "data");
  let files: string[];
  try {
    files = fs
      .readdirSync(dataDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".pdf"))
      .sort();
  } catch {
    return new Response("Data directory not found", { status: 500 });
  }

  // 5 files × 6000 chars ≈ 7500 tokens context → ~12 requests per 100k daily quota.
  // Covers resume summary + skills + full work experience comfortably.
  const MAX_CHARS_PER_DOC = 6000;

  let documents: { name: string; content: string }[];
  try {
    documents = await Promise.all(
      files.map(async (filename) => {
        const filepath = path.join(dataDir, filename);
        const name = filename.replace(/\.(md|pdf)$/, "");
        let content: string;
        if (filename.endsWith(".pdf")) {
          const buffer = fs.readFileSync(filepath);
          const { text } = await pdfParse(buffer);
          content = text as string;
        } else {
          content = fs.readFileSync(filepath, "utf-8");
        }
        return { name, content: content.slice(0, MAX_CHARS_PER_DOC) };
      })
    );
  } catch (err) {
    return new Response(
      `Failed to load documents: ${err instanceof Error ? err.message : String(err)}`,
      { status: 500 }
    );
  }

  // ─── STEP 2: AUGMENTATION ────────────────────────────────────────────────
  // Inject retrieved documents into the system prompt as numbered context blocks.
  // The model cites them as [1], [2], etc., enabling source attribution in the UI.
  // XML tags signal metadata to the model — it reads the content but
  // won't reproduce the tag format verbatim in responses.
  const context = documents
    .map((doc, i) => `<source id="${i + 1}">\n${doc.content}\n</source>`)
    .join("\n\n");

  const citationRule = `CITATION RULES (mandatory):
- Cite sources using ONLY the source id number in brackets, e.g. [1] or [2].
- Place the citation immediately after the fact it supports: "Teddy has 3 years of React experience [1]."
- Never write "Document 1", "source 1", or the filename in the answer. Numbers only.
- Only cite a source if it explicitly states the fact — no inference.
- Do NOT add a references list or bibliography at the end. Inline citations only.`;

  const systemPrompt =
    mode === "qa"
      ? `You are Teddy's technical portfolio assistant. Answer using ONLY the numbered documents below. Do not use outside knowledge.\n\n${citationRule}\n\nIf the answer is not in the documents, say so honestly.\n\nDocuments:\n${context}`
      : `You are a technical recruiter. Analyze the job description using ONLY Teddy's background in the numbered documents below. Do not use outside knowledge.\n\n${citationRule}\n\nFormat your response as:\n✅ **Matching skills & experience**\n⚠️ **Potential gaps**\n📊 **Overall match score**: X/10\n\nDocuments:\n${context}`;

  // ─── STEP 3: GENERATION ──────────────────────────────────────────────────
  // Stream the response from Groq (llama-3.3-70b). Streaming lets the frontend
  // render tokens progressively (ChatGPT-style) rather than waiting for the
  // full response.
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let result;
  try {
    result = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      stream: true,
    });
  } catch (err) {
    if (err instanceof Groq.APIError && err.status === 429) {
      return new Response("quota_exceeded", { status: 429 });
    }
    return new Response(
      `Groq error: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 }
    );
  }

  // Pass document order to the frontend so [1], [2] citations can be mapped
  // to human-readable filenames in the "Sources" panel.
  const docNames = documents.map((d) => d.name).join("\n");
  const docTypes = files.map((f) => (f.endsWith(".pdf") ? "pdf" : "md")).join("\n");

  // DeepSeek R1 emits a <think>...</think> block before the answer.
  // Track state to strip it out so only the final answer reaches the UI.
  let insideThink = false;
  let thinkBuf = "";

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const chunk of result) {
          let text = chunk.choices[0]?.delta?.content ?? "";
          if (!text) continue;

          thinkBuf += text;

          // Strip <think>...</think> blocks
          while (true) {
            if (insideThink) {
              const end = thinkBuf.indexOf("</think>");
              if (end === -1) { thinkBuf = thinkBuf.slice(-7); break; }
              thinkBuf = thinkBuf.slice(end + "</think>".length);
              insideThink = false;
            } else {
              const start = thinkBuf.indexOf("<think>");
              if (start === -1) {
                controller.enqueue(encoder.encode(thinkBuf));
                thinkBuf = "";
                break;
              }
              if (start > 0) controller.enqueue(encoder.encode(thinkBuf.slice(0, start)));
              thinkBuf = thinkBuf.slice(start + "<think>".length);
              insideThink = true;
            }
          }
        }
        if (!insideThink && thinkBuf) controller.enqueue(encoder.encode(thinkBuf));
      } catch (err) {
        controller.error(err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Document-Names": docNames,
      "X-Document-Types": docTypes,
    },
  });
}
