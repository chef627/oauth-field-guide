"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { requestGuide } from "@/components/generate-form";

export function ShareBar({ slug, query }: { slug: string; query: string }) {
  const router = useRouter();
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const markdownUrl = `/api/guides/${slug}/markdown`;
  return (
    <div className="no-print flex flex-wrap gap-2">
      <CopyButton label="Copy link" text={async () => window.location.href} />
      <CopyButton label="Copy as Markdown" text={async () => (await fetch(markdownUrl)).text()} />
      <a className="btn" href={markdownUrl} download={`${slug}-oauth-setup.md`}>
        Download .md
      </a>
      <button className="btn" onClick={() => window.print()}>
        Print / PDF
      </button>
      <button
        className="btn"
        disabled={regenerating}
        title="Run the research agent again. The current guide stays until the new one finishes."
        onClick={async () => {
          setRegenerating(true);
          setError(null);
          try {
            router.push(await requestGuide(query, true));
          } catch (e) {
            setError((e as Error).message);
            setRegenerating(false);
          }
        }}
      >
        {regenerating ? "Starting…" : "Re-research"}
      </button>
      {error && <span className="self-center text-sm text-red-700">{error}</span>}
    </div>
  );
}
