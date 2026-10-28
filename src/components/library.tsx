"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Difficulty } from "@/lib/guide";
import { AppLogo } from "@/components/app-logo";
import { DifficultyBadge } from "@/components/badges";
import { requestGuide } from "@/components/generate-form";

export interface LibraryItem {
  slug: string;
  name: string;
  logo: string | null;
  category: string;
  composioManaged: boolean | null;
  inCatalog: boolean;
  guide: { difficulty: Difficulty; devReady: string; productionReady: string; reviewed: boolean } | null;
}

type Filter = "all" | "ready" | "byo" | Difficulty;

export function Library({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.toLowerCase();
    return items
      .filter((i) => !needle || i.name.toLowerCase().includes(needle) || i.category.toLowerCase().includes(needle))
      .filter((i) => {
        if (filter === "all") return true;
        if (filter === "ready") return !!i.guide;
        if (filter === "byo") return i.composioManaged === false;
        return i.guide?.difficulty === filter;
      })
      .sort((a, b) => Number(!!b.guide) - Number(!!a.guide) || a.name.localeCompare(b.name));
  }, [items, q, filter]);

  const counts = {
    ready: items.filter((i) => i.guide).length,
    byo: items.filter((i) => i.composioManaged === false).length,
  };
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: `All ${items.length}` },
    { id: "ready", label: `Guide ready · ${counts.ready}` },
    { id: "byo", label: `Must bring own app · ${counts.byo}` },
    { id: "easy", label: "Easy" },
    { id: "moderate", label: "Moderate" },
    { id: "hard", label: "Hard" },
    { id: "gated", label: "Gated" },
  ];

  async function generate(name: string) {
    setPending(name);
    try {
      router.push(await requestGuide(name));
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
    }
  }

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                filter === f.id ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter apps…"
          className="w-full rounded-lg border border-line bg-white px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-56"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item) => {
          const body = (
            <>
              <div className="flex items-start gap-3">
                <AppLogo src={item.logo} name={item.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{item.name}</span>
                    {item.guide && <DifficultyBadge value={item.guide.difficulty} />}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                    <span className="capitalize">{item.category.replace(/[-_]/g, " ")}</span>
                    {item.composioManaged !== null && (
                      <span className={item.composioManaged ? "text-emerald-700" : "text-orange-700"}>
                        · {item.composioManaged ? "Composio-managed app" : "Bring your own app"}
                      </span>
                    )}
                    {!item.inCatalog && <span>· researched on request</span>}
                    {item.guide?.reviewed && <span className="text-emerald-700">· ✓ human-reviewed</span>}
                  </div>
                </div>
              </div>
              {item.guide ? (
                <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 text-xs">
                  <div>
                    <dt className="text-muted">Dev-ready</dt>
                    <dd className="font-medium">{item.guide.devReady}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">Any user can connect</dt>
                    <dd className="font-medium">{item.guide.productionReady}</dd>
                  </div>
                </dl>
              ) : (
                <div className="mt-3 border-t border-line pt-3 text-xs text-muted">
                  {pending === item.name ? "Starting agent…" : "No guide yet. Research it now →"}
                </div>
              )}
            </>
          );
          return item.guide ? (
            <Link key={item.slug} href={`/guides/${item.slug}`} className="card p-4 transition hover:border-stone-400 hover:shadow-sm">
              {body}
            </Link>
          ) : (
            <button
              key={item.slug}
              onClick={() => generate(item.name)}
              disabled={!!pending}
              className="card p-4 text-left opacity-80 transition hover:border-stone-400 hover:opacity-100"
            >
              {body}
            </button>
          );
        })}
      </div>
      {!visible.length && <p className="py-10 text-center text-sm text-muted">No apps match. Use the box above to research any app.</p>}
    </section>
  );
}
