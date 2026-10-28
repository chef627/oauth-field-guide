import { NextResponse } from "next/server";
import { startJob } from "@/lib/jobs";
import { findGuideSlug } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { query, force } = (await req.json().catch(() => ({}))) as { query?: string; force?: boolean };
  const q = query?.trim();
  if (!q || q.length > 200) return NextResponse.json({ error: "Enter an app name or website." }, { status: 400 });

  // Serve an existing guide instantly unless the user explicitly asks to regenerate it.
  const existing = force ? null : findGuideSlug(q);
  if (existing) return NextResponse.json({ slug: existing });

  try {
    const job = startJob(q);
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 429 });
  }
}
