"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const id = `m-${Math.random().toString(36).slice(2, 9)}`;
    import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
      mermaid
        .render(id, code)
        .then(({ svg: rendered }) => {
          if (!cancelled) setSvg(rendered);
        })
        .catch((err) => {
          if (!cancelled) setError(String(err));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (error) return <pre className="text-red-400 text-xs p-2">{error}</pre>;
  if (!svg)
    return (
      <div className="text-slate-500 text-xs animate-pulse py-2">
        Rendering diagram...
      </div>
    );
  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      className="my-4 flex justify-center"
    />
  );
}

const components: Components = {
  code(props) {
    const { className, children } = props;
    const lang = className?.replace("language-", "") ?? "";
    const code = String(children).trim();
    if (lang === "mermaid") return <MermaidBlock code={code} />;
    return (
      <code className="bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },
  pre(props) {
    const child = props.children as React.ReactElement<{ className?: string }>;
    const lang = child?.props?.className?.replace("language-", "") ?? "";
    if (lang === "mermaid") return <>{props.children}</>;
    return (
      <pre className="bg-slate-800 rounded-lg p-4 overflow-x-auto text-sm font-mono text-slate-200 my-4">
        {props.children}
      </pre>
    );
  },
  table(props) {
    return (
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm border-collapse">{props.children}</table>
      </div>
    );
  },
  th(props) {
    return (
      <th className="border border-slate-600 bg-slate-800 px-3 py-2 text-left text-slate-200 font-semibold">
        {props.children}
      </th>
    );
  },
  td(props) {
    return (
      <td className="border border-slate-700 px-3 py-2 text-slate-300">
        {props.children}
      </td>
    );
  },
};

function MarkdownPreview() {
  const params = useSearchParams();
  const name = params.get("name") ?? "";
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!name) return;
    setLoading(true);
    setError("");
    fetch(`/api/document/${encodeURIComponent(name)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      })
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, [name]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 text-sm animate-pulse">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400 text-sm">
        Failed to load: {error}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-none prose prose-invert prose-sm prose-headings:text-slate-100 prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-slate-100 prose-code:text-blue-300 prose-a:text-blue-400">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function DocPreviewPage() {
  return (
    <div className="min-h-screen bg-[#0d1424] text-white overflow-auto">
      <Suspense
        fallback={
          <div className="p-6 text-slate-500 text-sm animate-pulse">
            Loading...
          </div>
        }
      >
        <MarkdownPreview />
      </Suspense>
    </div>
  );
}
