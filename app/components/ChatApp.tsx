"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Mode = "qa" | "job-match";

const DEMO_ID = "demo";

const DEMO_DOC_TYPE_MAP: Record<string, "pdf" | "md"> = {
  "0-resume": "pdf",
  "basketball-shot-analyzer": "md",
  "coffee-shop-backend": "md",
  "coffee-shop-frontend": "md",
};

const DEMO_MESSAGES: Message[] = [
  {
    role: "user",
    content: "What frontend technologies has Teddy worked with?",
  },
  {
    role: "assistant",
    content: `Teddy has worked with a range of modern frontend technologies:\n\n**Frameworks & Libraries**\nReact and Next.js are his primary frameworks [1][4]. He has built production applications with the Next.js App Router, including server components, API routes, and streaming responses [4].\n\n**Language**\nTypeScript is his default for frontend projects [1][4], applied across components, API contracts, and data models.\n\n**Styling**\nTailwind CSS for rapid, responsive UI development [4].\n\n**Other tools**\nMediaPipe for real-time computer vision inference on the client [2], and WebSocket-based interfaces for live data.`,
    sources: [
      { index: 1, name: "0-resume" },
      { index: 2, name: "basketball-shot-analyzer" },
      { index: 4, name: "coffee-shop-frontend" },
    ],
  },
];

const DEMO_JM_MESSAGES: Message[] = [
  {
    role: "user",
    content: `Senior Frontend Engineer — Luminary Labs (Sydney, AU)

About Us:
Luminary Labs builds B2B SaaS tools for creative agencies. Our platform helps teams manage campaigns, assets, and client feedback in one place.

Role:
We're looking for a Senior Frontend Engineer to lead UI development on our Next.js platform. You'll own key product surfaces, collaborate closely with design, and mentor junior engineers.

Requirements:
- 3+ years of production React / Next.js experience
- Strong TypeScript skills
- Experience with REST APIs and real-time data (WebSockets or SSE)
- Familiarity with Tailwind CSS or similar utility-first CSS
- Experience with cloud platforms (AWS or GCP)
- Bonus: computer vision or ML integration experience`,
  },
  {
    role: "assistant",
    content: `✅ **Matching skills & experience**

- **React & Next.js (3+ yrs required):** Teddy's primary frameworks in production [1][4]. His work on the coffee shop frontend uses the Next.js App Router with server components and API routes [4].
- **TypeScript:** Default language across all projects [1][4].
- **REST APIs & real-time data:** Built WebSocket-based real-time interfaces and streaming API responses [4].
- **Tailwind CSS:** Used throughout frontend projects for responsive UI [4].
- **Computer vision / ML (bonus):** Integrated MediaPipe and Three.js for real-time pose detection in a production app [2] — directly satisfies the bonus requirement.

⚠️ **Potential gaps**

- **Cloud platforms (AWS / GCP):** Not explicitly mentioned in the documents [1][2][3][4]. Worth discussing in interview.
- **Mentoring / team lead:** No direct evidence of mentoring junior engineers in the documents, though senior-level ownership is clear [1].

📊 **Overall match score: 8.5 / 10**

Strong technical alignment across every core requirement. The computer vision bonus is a genuine differentiator. Main unknown is cloud infrastructure depth.`,
    sources: [
      { index: 1, name: "0-resume" },
      { index: 2, name: "basketball-shot-analyzer" },
      { index: 3, name: "coffee-shop-backend" },
      { index: 4, name: "coffee-shop-frontend" },
    ],
  },
];

const SUGGESTIONS = [
  "What frontend technologies has Teddy worked with?",
  "Describe the architecture of the Basketball Shot Analyzer",
  "What is Teddy's most impactful achievement at Vision Verse?",
  "What databases and backend technologies has Teddy used?",
];

interface Source {
  index: number;
  name: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

function parseSources(text: string, docNames: string[]): Source[] {
  const cited = new Set<number>();
  const re = /\[(\d+)\]/g;
  let match;
  while ((match = re.exec(text)) !== null) cited.add(Number(match[1]));
  return Array.from(cited)
    .filter((i) => i >= 1 && i <= docNames.length)
    .sort((a, b) => a - b)
    .map((i) => ({ index: i, name: docNames[i - 1] }));
}

export default function ChatApp({ chatId }: { chatId?: string }) {
  const isDemo = chatId === DEMO_ID;
  const [mode, setMode] = useState<Mode>("qa");
  const [qaMessages, setQaMessages] = useState<Message[]>(
    isDemo ? DEMO_MESSAGES : []
  );
  const [jmMessages, setJmMessages] = useState<Message[]>(
    isDemo ? DEMO_JM_MESSAGES : []
  );
  const [input, setInput] = useState("");
  const [jd, setJd] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [activeDocType, setActiveDocType] = useState<"pdf" | "md">("md");
  const [docTypeMap, setDocTypeMap] = useState<Record<string, "pdf" | "md">>(
    isDemo ? DEMO_DOC_TYPE_MAP : {}
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = mode === "qa" ? qaMessages : jmMessages;

  // Load persisted messages on mount (skip for demo — demo state is hardcoded)
  useEffect(() => {
    if (!chatId || isDemo) return;
    try {
      const qa = localStorage.getItem(`chat-qa-${chatId}`);
      const jm = localStorage.getItem(`chat-jm-${chatId}`);
      const types = localStorage.getItem(`chat-types-${chatId}`);
      if (qa) setQaMessages(JSON.parse(qa));
      if (jm) setJmMessages(JSON.parse(jm));
      if (types) setDocTypeMap(JSON.parse(types));
    } catch {}
  }, [chatId, isDemo]);

  // Persist after streaming completes — skip during streaming to avoid per-chunk writes
  useEffect(() => {
    if (!chatId || isDemo || isStreaming) return;
    if (qaMessages.length > 0) localStorage.setItem(`chat-qa-${chatId}`, JSON.stringify(qaMessages));
    if (jmMessages.length > 0) localStorage.setItem(`chat-jm-${chatId}`, JSON.stringify(jmMessages));
    if (Object.keys(docTypeMap).length > 0) localStorage.setItem(`chat-types-${chatId}`, JSON.stringify(docTypeMap));
  }, [qaMessages, jmMessages, docTypeMap, isStreaming, chatId, isDemo]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [qaMessages, jmMessages]);

  useEffect(() => {
    if (!isStreaming && mode === "qa") inputRef.current?.focus();
  }, [isStreaming, mode]);

  const send = async (userMessage: string) => {
    if (!userMessage.trim() || isStreaming) return;

    const currentMode = mode;
    const setter = currentMode === "qa" ? setQaMessages : setJmMessages;

    setter((prev) => [
      ...prev,
      { role: "user", content: userMessage },
      { role: "assistant", content: "" },
    ]);

    if (currentMode === "qa") setInput("");
    else setJd("");
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, mode: currentMode }),
      });

      if (!res.ok) {
        const body = await res.text();
        if (res.status === 429 || body === "quota_exceeded") throw new Error("__quota__");
        if (res.status === 503 || body === "api_key_missing") throw new Error("__no_key__");
        throw new Error(body);
      }

      const docNames = (res.headers.get("X-Document-Names") || "")
        .split("\n")
        .filter(Boolean);
      const docTypesRaw = (res.headers.get("X-Document-Types") || "")
        .split("\n")
        .filter(Boolean);
      const newTypeMap: Record<string, "pdf" | "md"> = {};
      docNames.forEach((n, i) => {
        newTypeMap[n] = (docTypesRaw[i] as "pdf" | "md") ?? "md";
      });
      setDocTypeMap((prev) => ({ ...prev, ...newTypeMap }));

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setter((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: accumulated },
        ]);
      }
      accumulated += decoder.decode(); // flush any buffered multibyte sequence

      setter((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: accumulated,
          sources: parseSources(accumulated, docNames),
        },
      ]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Unknown error";
      const isQuota = raw === "__quota__";
      const isNoKey = raw === "__no_key__";
      const content =
        isQuota || isNoKey
          ? `⚠️ ${isQuota ? "API quota exhausted." : "API key not configured."} View the [pre-loaded demo](/chat/demo) instead.`
          : `⚠️ ${raw}`;
      setter((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content },
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="h-screen bg-[#070d1a] text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="border-b border-slate-800 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">
              Teddy&apos;s AI Portfolio
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5">
              RAG demo &middot; in-context retrieval &middot; Llama 3.3 70B via Groq
              {chatId && (
                <span className="ml-2 font-mono text-slate-700">{chatId}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && !isDemo && (
              <button
                onClick={() => {
                  if (mode === "qa") {
                    setQaMessages([]);
                    if (chatId) localStorage.removeItem(`chat-qa-${chatId}`);
                  } else {
                    setJmMessages([]);
                    if (chatId) localStorage.removeItem(`chat-jm-${chatId}`);
                  }
                }}
                disabled={isStreaming}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:cursor-not-allowed"
              >
                Clear
              </button>
            )}
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 gap-0.5">
              {(["qa", "job-match"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  disabled={isStreaming}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    mode === m
                      ? "bg-blue-600 text-white"
                      : "text-slate-400 hover:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}
                >
                  {m === "qa" ? "Ask about Teddy" : "Job Match"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Body: chat + optional doc viewer */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Chat */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
              {messages.length === 0 && (
                <div className="mt-16 space-y-6">
                  <div className="text-center space-y-1">
                    <p className="text-slate-400 text-sm">
                      {mode === "qa"
                        ? "Ask anything about Teddy's skills, experience, or projects."
                        : "Paste a job description to analyze how well Teddy's background matches."}
                    </p>
                    <p className="text-slate-600 text-xs">
                      Reading from{" "}
                      <code className="text-slate-500">/data/*.md + *.pdf</code>
                    </p>
                  </div>

                  {mode === "qa" && (
                    <div className="grid grid-cols-2 gap-2 max-w-2xl mx-auto">
                      {SUGGESTIONS.map((q) => (
                        <button
                          key={q}
                          onClick={() => send(q)}
                          disabled={isStreaming}
                          className="text-left px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs hover:border-blue-500 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className={msg.role === "user" ? "max-w-[78%]" : "w-full"}>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-blue-600 text-white whitespace-pre-wrap"
                          : "bg-slate-900 border border-slate-800 text-slate-200"
                      }`}
                    >
                      {msg.role === "user" ? (
                        msg.content
                      ) : msg.content ? (
                        <div className="prose prose-sm prose-invert max-w-none prose-p:my-1.5 prose-headings:text-slate-100 prose-strong:text-slate-100 prose-ul:my-1.5 prose-li:my-0.5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {isStreaming && i === messages.length - 1
                              ? msg.content + "▌"
                              : msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="text-slate-500 animate-pulse">▌</span>
                      )}
                    </div>

                    {/* Source pills — clickable to open doc viewer */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-2 pl-1">
                        <p className="text-[11px] text-slate-600 mb-1.5 uppercase tracking-wider">
                          Sources
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.sources.map(({ index, name }) => (
                            <button
                              key={index}
                              onClick={() => {
                                if (activeDoc === name) {
                                  setActiveDoc(null);
                                } else {
                                  setActiveDoc(name);
                                  setActiveDocType(docTypeMap[name] ?? "md");
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                activeDoc === name
                                  ? "bg-blue-600 border-blue-500 text-white"
                                  : "bg-slate-900 border-slate-700 text-slate-400 hover:border-blue-500 hover:text-slate-200"
                              }`}
                            >
                              <span className="font-mono font-semibold">
                                [{index}]
                              </span>
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div className="border-t border-slate-800 px-6 py-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              {isDemo ? (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-500">
                  <span>Demo version. New questions disabled.</span>
                  <a
                    href="mailto:teddyhiny@gmail.com"
                    className="text-blue-500 hover:text-blue-400 transition-colors"
                  >
                    Email teddyhiny@gmail.com to try the full version.
                  </a>
                </div>
              ) : mode === "qa" ? (
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send(input);
                      }
                    }}
                    disabled={isStreaming}
                    placeholder="Ask about Teddy's skills, projects, or experience..."
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={() => send(input)}
                    disabled={isStreaming || !input.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  >
                    {isStreaming ? "..." : "Send"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    disabled={isStreaming}
                    placeholder="Paste a job description here..."
                    rows={5}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none disabled:opacity-50"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => send(jd)}
                      disabled={isStreaming || !jd.trim()}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
                    >
                      {isStreaming ? "Analyzing..." : "Analyze Match"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Document viewer panel — desktop only */}
        {activeDoc && (
          <div className="hidden md:flex w-[45%] border-l border-slate-800 flex-col flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
              <span className="text-xs text-slate-300 font-medium truncate">
                {activeDoc}
              </span>
              <button
                onClick={() => setActiveDoc(null)}
                className="text-slate-500 hover:text-white text-lg leading-none ml-3"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {activeDocType === "pdf" ? (
              <iframe
                key={activeDoc}
                src={`/api/document/${encodeURIComponent(activeDoc)}`}
                className="flex-1 w-full bg-white"
                title={activeDoc}
              />
            ) : (
              <iframe
                key={activeDoc}
                src={`/doc-preview?name=${encodeURIComponent(activeDoc)}`}
                className="flex-1 w-full"
                title={activeDoc}
              />
            )}
          </div>
        )}

        {/* Mobile fullscreen doc viewer */}
        {activeDoc && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col bg-[#070d1a]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 flex-shrink-0">
              <span className="text-xs text-slate-300 font-medium truncate flex-1 mr-3">
                {activeDoc}
              </span>
              <button
                onClick={() => setActiveDoc(null)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors flex-shrink-0"
                aria-label="Close"
              >
                ← Back to chat
              </button>
            </div>
            {activeDocType === "pdf" ? (
              <iframe
                key={activeDoc}
                src={`/api/document/${encodeURIComponent(activeDoc)}`}
                className="flex-1 w-full bg-white"
                title={activeDoc}
              />
            ) : (
              <iframe
                key={activeDoc}
                src={`/doc-preview?name=${encodeURIComponent(activeDoc)}`}
                className="flex-1 w-full"
                title={activeDoc}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
