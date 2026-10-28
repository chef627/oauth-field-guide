"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CatalogApp } from "@/lib/guide";
import { AppLogo } from "@/components/app-logo";
import { requestGuide } from "@/components/generate-form";

export function NoGuideYet({ app }: { app: CatalogApp }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <div className="flex justify-center">
        <AppLogo src={app.logo} name={app.name} size={64} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{app.name}</h1>
      <p className="mt-2 text-muted">
        {app.composioManaged
          ? `Composio already manages a ${app.name} OAuth app, so your users can connect without you registering one. A guide covers setting up your own for branding, custom scopes or separate quota.`
          : `Composio has no managed ${app.name} OAuth app, so you will need to register your own.`}
      </p>
      <button
        className="btn-primary mt-6"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            router.push(await requestGuide(app.name));
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {busy ? "Starting…" : "Research this app now (≈3 min)"}
      </button>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
