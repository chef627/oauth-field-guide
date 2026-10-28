"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent/run";
import { requestGuide } from "@/components/generate-form";

type Stamped = AgentEvent & { at: number };
type ToolRow = Extract<AgentEvent, { type: "tool" }> & { at: number; result?: { ok: boolean; summary: string } };
type Row = ToolRow | (Extract<AgentEvent, { type: "status" | "thought" }> & { at: number });

const KIND: Record<ToolRow["kind"], { icon: string; label: string; style: string }> = {
  search: { icon: "⌕", label: "Search", style: "bg-stone-100 text-stone-700" },
  read: { icon: "▤", label: "Read", style: "bg-blue-50 text-blue-800" },
  probe: { icon: "⚡", label: "Live probe", style: "bg-emerald-600 text-white" },
  composio: { icon: "◎", label: "Composio", style: "bg-indigo-50 text-indigo-800" },
};

export function LiveResearch({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState<string>("");
  const [startedAt, setStartedAt] = useState<number>(Date.now());
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/jobs/${jobId}/events`);
    // The server replays history on (re)connect, so start from a clean list each time.
    es.onopen = () => setRows([]);
    es.onmessage = (msg) => {
      const e = JSON.parse(msg.data) as Stamped | { type: "meta"; query: string; startedAt: number };
      if (e.type === "meta") {
        setQuery(e.query);
        setStartedAt(e.startedAt);
        return;
      }
      if (e.type === "done") {
        setDone(e.slug);
        es.close();
        setTimeout(() => router.push(`/guides/${e.slug}`), 1500);
        return;
      }
      if (e.type === "error") {
        setError(e.message);
        es.close();
        return;
      }
      if (e.type === "tool_result") {
        setRows((prev) => prev.map((r) => (r.type === "tool" && r.id === e.id ? { ...r, result: { ok: e.ok, summary: e.summary } } : r)));
        return;
      }
      setRows((prev) => [...prev, e]);
    };
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setError("Lost connection to the research job (the server may have restarted).");
    };
    return () => es.close();
  }, [jobId, router]);

  useEffect(() => {
    if (done || error) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [done, error]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [rows.length]);

  const tools = rows.filter((r): r is ToolRow => r.type === "tool");
  const count = (k: ToolRow["kind"]) => tools.filter((t) => t.kind === k).length;
  const elapsed = Math.max(0, Math.round((now - startedAt) / 1000));

  return (
    <div className="mx-auto max-w-3xl py-10">
      <Link href="/" className="text-sm text-muted hover:text-ink">
        ← Library
      </Link>
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">{done ? "Guide ready" : error ? "Research failed" : "Agent is researching"}</p>
          <h1 className="text-3xl font-semibold tracking-tight">{query || "…"}</h1>
        </div>
        <div className="text-right font-mono text-2xl tabular-nums text-muted">
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-4 gap-2 text-center text-xs">
        {(["search", "read", "probe", "composio"] as const).map((k) => (
          <div key={k} className="card py-2">
            <div className="text-xl font-semibold tabular-nums">{count(k)}</div>
            <div className="text-muted">{k === "search" ? "searches" : k === "read" ? "pages read" : k === "probe" ? "live probes" : "catalog checks"}</div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm text-muted">
        The agent reads official docs and developer reports, then runs read-only probes against the provider (OAuth discovery, a test authorization
        request with an unregistered client, console URL checks) so the guide can say what it observed itself, not only what docs claim.
      </p>

      <ol className="mt-6 space-y-2">
        {rows.map((r, i) =>
          r.type === "tool" ? (
            <li key={r.id} className="card flex gap-3 p-3 text-sm">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md text-sm ${KIND[r.kind].style}`} title={KIND[r.kind].label}>
                {KIND[r.kind].icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{r.label}</span>
                  <span className="shrink-0 text-xs">
                    {!r.result ? <Spinner /> : r.result.ok ? <span className="text-emerald-700">✓</span> : <span className="text-red-700">✗</span>}
                  </span>
                </div>
                {r.result?.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{r.result.summary}</p>}
              </div>
            </li>
          ) : r.type === "thought" ? (
            <li key={i} className="px-3 py-1 text-sm text-stone-600 italic">
              {r.text}
            </li>
          ) : (
            <li key={i} className="flex items-center gap-2 px-3 py-1 text-sm font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {r.message}
            </li>
          ),
        )}
        {!done && !error && (
          <li className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
            <Spinner /> working…
          </li>
        )}
      </ol>

      {done && (
        <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="font-medium">Guide written. Opening it…</p>
          <Link className="text-sm text-accent underline" href={`/guides/${done}`}>
            Go to the guide
          </Link>
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">{error}</p>
          {query && (
            <button className="btn mt-3" onClick={async () => router.push(await requestGuide(query, true))}>
              Try again
            </button>
          )}
        </div>
      )}
      <div ref={bottom} />
    </div>
  );
}

function Spinner() {
  return <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-stone-300 border-t-accent align-middle" />;
}
