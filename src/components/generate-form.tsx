"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export async function requestGuide(query: string, force = false): Promise<string> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, force }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data.slug ? `/guides/${data.slug}` : `/generate/${data.jobId}`;
}

export function GenerateForm({ examples }: { examples: string[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    setError(null);
    try {
      router.push(await requestGuide(q.trim()));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(query);
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="App name or website, e.g. PandaDoc or pandadoc.com"
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-4 py-3 text-base shadow-sm outline-none focus:border-accent focus:ring-4 focus:ring-accent/10"
          aria-label="App name or website"
        />
        <button className="btn-primary justify-center py-3" disabled={busy || !query.trim()}>
          {busy ? "Starting…" : "Get setup guide"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      <p className="mt-3 text-sm text-muted">
        Not in the library? An agent researches it live in about 2–4 minutes. Try{" "}
        {examples.map((ex, i) => (
          <span key={ex}>
            <button type="button" onClick={() => submit(ex)} className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent">
              {ex}
            </button>
            {i < examples.length - 1 ? ", " : "."}
          </span>
        ))}
      </p>
    </div>
  );
}
