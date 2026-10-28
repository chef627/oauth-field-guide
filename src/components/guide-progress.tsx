"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Per-viewer checklist progress, kept in localStorage so a developer can work through a guide over days.
const Ctx = createContext<{ done: Set<string>; toggle: (id: string) => void; total: number } | null>(null);

export function ProgressProvider({ slug, total, children }: { slug: string; total: number; children: React.ReactNode }) {
  const key = `oauth-guide-progress:${slug}`;
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      setDone(new Set(JSON.parse(localStorage.getItem(key) ?? "[]")));
    } catch {}
  }, [key]);

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...next]));
      } catch {}
      return next;
    });

  return <Ctx.Provider value={{ done, toggle, total }}>{children}</Ctx.Provider>;
}

export function StepCheck({ id, label }: { id: string; label: string }) {
  const ctx = useContext(Ctx)!;
  const checked = ctx.done.has(id);
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={() => ctx.toggle(id)}
      aria-label={`Mark “${label}” done`}
      className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#3f3cbb]"
    />
  );
}

export function ProgressBar() {
  const ctx = useContext(Ctx)!;
  const pct = ctx.total ? Math.round((ctx.done.size / ctx.total) * 100) : 0;
  return (
    <div className="no-print flex items-center gap-3 text-xs text-muted">
      <div className="h-1.5 w-32 overflow-hidden rounded-full bg-stone-200">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span>
        {ctx.done.size}/{ctx.total} steps done
      </span>
    </div>
  );
}
