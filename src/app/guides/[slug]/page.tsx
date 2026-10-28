import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Guide } from "@/lib/guide";
import { getGuide, loadCatalog } from "@/lib/store";
import { DIFFICULTY } from "@/lib/labels";
import { AppLogo } from "@/components/app-logo";
import { Cites, ConfidenceChip, DifficultyBadge, OwnerChip } from "@/components/badges";
import { CopyButton } from "@/components/copy-button";
import { ProgressBar, ProgressProvider, StepCheck } from "@/components/guide-progress";
import { ShareBar } from "@/components/share-bar";
import { NoGuideYet } from "@/components/no-guide-yet";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const g = getGuide(slug);
  return g
    ? { title: `${g.appName} OAuth app setup · OAuth Field Guide`, description: g.summary }
    : { title: "OAuth Field Guide" };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    const app = loadCatalog().apps.find((a) => a.slug === slug);
    if (!app) notFound();
    return <NoGuideYet app={app} />;
  }
  const g = guide;
  const totalSteps = g.phases.reduce((n, p) => n + p.steps.length, 0);
  const confidenceCounts: Record<string, number> = {};
  for (const claim of [...g.phases.flatMap((p) => p.steps), ...g.blockers]) {
    confidenceCounts[claim.confidence] = (confidenceCounts[claim.confidence] ?? 0) + 1;
  }

  return (
    <ProgressProvider slug={g.slug} total={totalSteps}>
      <nav className="no-print pt-6 text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          Library
        </Link>{" "}
        / {g.appName}
      </nav>

      {/* ---------- header ---------- */}
      <header className="mt-4 flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <AppLogo src={g.logo} name={g.appName} size={56} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{g.appName} OAuth app setup</h1>
            <p className="mt-1 text-sm text-muted">
              <a href={g.website} className="hover:text-ink" target="_blank" rel="noreferrer">
                {g.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>{" "}
              · Researched {g.meta.generatedAt.slice(0, 10)} by agent ({g.meta.toolCalls} tool calls, {g.sources.length} sources, {g.probes.length} live probes)
              {g.review.status === "human_reviewed" && <span className="ml-1 font-medium text-emerald-700">· Human-reviewed {g.review.reviewedAt?.slice(0, 10)}</span>}
            </p>
          </div>
        </div>
        <ShareBar slug={g.slug} query={g.meta.query} />
      </header>

      <p className="mt-6 max-w-3xl text-lg leading-relaxed">{g.summary}</p>

      {/* ---------- verdict ---------- */}
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <div className="section-title !mb-2">Difficulty</div>
          <DifficultyBadge value={g.verdict.difficulty} large />
          <p className="mt-2 text-sm text-muted">{g.verdict.difficultyReason}</p>
        </div>
        <Verdict title="Dev-ready" subtitle="Works with your own / test account" value={g.verdict.devReady.estimate} detail={g.verdict.devReady.detail} />
        <Verdict
          title="Production-ready"
          subtitle={g.verdict.productionReady.approvalRequired ? "Provider approval required" : "No provider approval required"}
          value={g.verdict.productionReady.estimate}
          detail={g.verdict.productionReady.detail}
          warn={g.verdict.productionReady.approvalRequired}
        />
        <Verdict title="Hands-on effort" subtitle="Your time, excluding waits" value={g.verdict.handsOnEffort} />
      </section>

      <ComposioCallout g={g} />

      <section className="mt-4 rounded-xl border-2 border-accent/30 bg-accent-soft p-4">
        <div className="text-xs font-semibold tracking-wider text-accent uppercase">Start here</div>
        <p className="prose-tight mt-1 font-medium">
          <Linkify text={g.nextAction} />
        </p>
      </section>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-10">
          {/* ---------- access paths ---------- */}
          {g.accessPaths.length > 0 && (
            <section>
              <h2 className="section-title">Ways to ship</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3 font-medium">Path</th>
                      <th className="py-2 pr-3 font-medium">Review</th>
                      <th className="py-2 pr-3 font-medium">Timeline</th>
                      <th className="py-2 font-medium">Limits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.accessPaths.map((p) => (
                      <tr key={p.name} className="border-b border-line align-top">
                        <td className="py-2.5 pr-3">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-muted">{p.whenToUse}</div>
                        </td>
                        <td className="py-2.5 pr-3">{p.reviewRequired ? <span className="font-medium text-orange-700">Yes</span> : "No"}</td>
                        <td className="py-2.5 pr-3">{p.timeline}</td>
                        <td className="py-2.5 text-muted">{p.limits}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ---------- prerequisites ---------- */}
          {g.prerequisites.length > 0 && (
            <section>
              <h2 className="section-title">Before you start</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {g.prerequisites.map((p) => (
                  <li key={p.item} className="card p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">
                        {p.item}
                        {!p.required && <span className="ml-1 text-xs font-normal text-muted">(optional)</span>}
                      </span>
                      <OwnerChip value={p.owner} />
                    </div>
                    <p className="mt-1 text-muted">{p.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---------- steps ---------- */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="section-title !mb-0">Step by step</h2>
              <ProgressBar />
            </div>
            <ol className="space-y-6">
              {g.phases.map((phase, pi) => (
                <li key={pi} className="card overflow-hidden">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-stone-50 px-4 py-3">
                    <div>
                      <h3 className="font-semibold">
                        <span className="mr-2 text-muted">{pi + 1}.</span>
                        {phase.title}
                      </h3>
                      <p className="text-sm text-muted">{phase.goal}</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="chip border-line bg-white text-ink">⏱ {phase.duration}</span>
                      {phase.waitTime && <span className="chip border-orange-200 bg-orange-50 text-orange-800">⌛ Wait: {phase.waitTime}</span>}
                    </div>
                  </div>
                  <ul className="divide-y divide-line">
                    {phase.steps.map((s, si) => (
                      <li key={si} className="flex gap-3 px-4 py-3">
                        <StepCheck id={`${pi}:${si}`} label={s.title} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mr-1 font-medium">{s.title}</span>
                            <OwnerChip value={s.owner} />
                            <ConfidenceChip value={s.confidence} />
                            <Cites ids={s.sourceIds} />
                          </div>
                          <p className="prose-tight mt-1 text-sm leading-relaxed text-stone-700">
                            <Linkify text={s.detail} />
                          </p>
                          {s.url && (
                            <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block max-w-full truncate text-xs text-accent hover:underline">
                              ↗ {s.url.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </section>

          {/* ---------- scopes ---------- */}
          {g.scopes.length > 0 && (
            <section>
              <h2 className="section-title">Scopes and what they trigger</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <tbody>
                    {g.scopes.map((s) => (
                      <tr key={s.scope} className="border-b border-line align-top">
                        <td className="py-2 pr-3">
                          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs break-all">{s.scope}</code>
                        </td>
                        <td className="py-2 pr-3">{s.purpose}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={`chip ${
                              s.sensitivity === "restricted"
                                ? "border-red-200 bg-red-50 text-red-800"
                                : s.sensitivity === "sensitive"
                                  ? "border-amber-200 bg-amber-50 text-amber-800"
                                  : "border-line bg-white text-muted"
                            }`}
                          >
                            {s.sensitivity}
                          </span>
                        </td>
                        <td className="py-2 text-muted">{s.reviewNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ---------- blockers ---------- */}
          <section>
            <h2 className="section-title">If you get blocked</h2>
            <div className="space-y-2">
              {g.blockers.map((b) => (
                <details key={b.title} className="card group p-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                    <span className="font-medium">{b.title}</span>
                    <span className="flex items-center gap-2">
                      <ConfidenceChip value={b.confidence} />
                      <span className="text-muted transition group-open:rotate-90">›</span>
                    </span>
                  </summary>
                  <div className="prose-tight space-y-2 border-t border-line px-4 py-3 text-sm">
                    <p>
                      <span className="font-medium">You see: </span>
                      <span className="text-stone-700">{b.symptom}</span>
                    </p>
                    <p>
                      <span className="font-medium">Do this: </span>
                      <span className="text-stone-700">
                        <Linkify text={b.fix} />
                      </span>
                      <Cites ids={b.sourceIds} />
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ---------- drafts ---------- */}
          {g.drafts.length > 0 && (
            <section>
              <h2 className="section-title">Drafts the agent wrote for you</h2>
              <div className="space-y-3">
                {g.drafts.map((d) => (
                  <div key={d.title} className="card">
                    <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                      <div>
                        <div className="text-sm font-medium">{d.title}</div>
                        <div className="text-xs text-muted">{d.purpose}</div>
                      </div>
                      <CopyButton text={d.content} className="btn no-print shrink-0" />
                    </div>
                    <pre className="px-4 py-3 font-sans text-sm leading-relaxed whitespace-pre-wrap text-stone-700">{d.content}</pre>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------- evidence ---------- */}
          <section id="evidence">
            <h2 className="section-title">Evidence</h2>
            <div className="card divide-y divide-line">
              {g.probes.length > 0 && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold">What the agent tested live</h3>
                  <p className="mb-3 text-xs text-muted">Read-only probes run during research. No accounts were created and nothing was submitted.</p>
                  <ul className="space-y-3 text-sm">
                    {g.probes.map((p, i) => (
                      <li key={i}>
                        <div className="font-medium">{p.action}</div>
                        <code className="font-mono text-xs break-all text-muted">{p.target}</code>
                        <p className="mt-1 text-stone-700">
                          <span className="text-muted">Observed:</span> {p.observed}
                        </p>
                        <p className="text-stone-700">
                          <span className="text-muted">So:</span> {p.conclusion}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {g.uncertainties.length > 0 && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold">Not verified</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
                    {g.uncertainties.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                </div>
              )}
              {g.review.status === "human_reviewed" && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold">Human review ({g.review.reviewedAt?.slice(0, 10)})</h3>
                  {g.review.summary && <p className="mt-1 text-sm text-stone-700">{g.review.summary}</p>}
                  <ul className="mt-2 space-y-2 text-sm">
                    {g.review.corrections.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span
                          className={`chip h-fit ${
                            c.action === "corrected"
                              ? "border-red-200 bg-red-50 text-red-800"
                              : c.action === "confirmed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                          }`}
                        >
                          {c.action}
                        </span>
                        <span className="prose-tight text-stone-700">
                          <span className="font-medium">{c.claim}</span> → {c.finding}{" "}
                          {c.sourceUrl && (
                            <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                              source
                            </a>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="p-4">
                <h3 className="text-sm font-semibold">Sources</h3>
                <ol className="mt-2 space-y-1 text-sm">
                  {g.sources.map((s) => (
                    <li key={s.id} id={`source-${s.id}`} className="flex gap-2 target:bg-yellow-50">
                      <span className="w-6 shrink-0 text-right text-muted">{s.id}.</span>
                      <span className="min-w-0">
                        <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                          {s.title}
                        </a>{" "}
                        <span className="text-xs text-muted">({s.kind === "probe" ? "live probe" : s.kind})</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>
        </div>

        {/* ---------- sidebar ---------- */}
        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <section className="card p-4">
            <h2 className="section-title">Agent vs. you</h2>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <OwnerChip value="agent" /> can do
            </h3>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-stone-700">
              {g.agentHelp.canDo.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
            <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
              <OwnerChip value="you" /> must do
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-stone-700">
              {g.agentHelp.youMustDo.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </section>

          <section className="card p-4">
            <h2 className="section-title">Technical reference</h2>
            <dl className="space-y-2.5 text-sm">
              {g.composio?.redirectUri && <TechRow label="Redirect URI (Composio)" value={g.composio.redirectUri} copy />}
              {g.technical.consoleUrl && <TechRow label="Developer console" value={g.technical.consoleUrl} link />}
              {g.technical.docsUrl && <TechRow label="OAuth docs" value={g.technical.docsUrl} link />}
              {g.technical.authorizeUrl && <TechRow label="Authorize URL" value={g.technical.authorizeUrl} copy />}
              {g.technical.tokenUrl && <TechRow label="Token URL" value={g.technical.tokenUrl} copy />}
              <TechRow label="PKCE" value={g.technical.pkce} />
              <TechRow label="Refresh tokens" value={g.technical.refreshTokens} />
              <TechRow label="Redirect URI rules" value={g.technical.redirectUriRules} />
              {g.technical.notes && <TechRow label="Notes" value={g.technical.notes} />}
            </dl>
          </section>

          <section className="card p-4 text-sm">
            <h2 className="section-title">How confident is this?</h2>
            <ul className="space-y-1.5">
              {(["tested", "documented", "reported", "unverified"] as const).map((c) => (
                <li key={c} className="flex items-center justify-between">
                  <ConfidenceChip value={c} />
                  <span className="text-muted">{confidenceCounts[c] ?? 0} claims</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              Counts cover steps and blockers. {DIFFICULTY[g.verdict.difficulty].label}: {DIFFICULTY[g.verdict.difficulty].blurb}{" "}
              <Link href="/methodology" className="text-accent hover:underline">
                Method
              </Link>
            </p>
            <p className="mt-2 text-xs text-muted">
              Generated with {g.meta.model} in {Math.round(g.meta.durationMs / 1000)}s from {g.sources.length} sources.
            </p>
          </section>
        </aside>
      </div>
    </ProgressProvider>
  );
}

function Verdict({ title, subtitle, value, detail, warn }: { title: string; subtitle: string; value: string; detail?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <div className="section-title !mb-1">{title}</div>
      <div className="text-lg leading-snug font-semibold">{value}</div>
      <div className={`mt-0.5 text-xs font-medium ${warn ? "text-orange-700" : "text-muted"}`}>{subtitle}</div>
      {detail && <p className="mt-2 text-sm text-muted">{detail}</p>}
    </div>
  );
}

function ComposioCallout({ g }: { g: Guide }) {
  if (!g.composio) return null;
  const managed = g.composio.composioManaged;
  return (
    <section className={`mt-4 rounded-xl border p-4 text-sm ${managed ? "border-emerald-200 bg-emerald-50/60" : "border-orange-200 bg-orange-50/60"}`}>
      <div className="font-semibold">
        {managed ? "You may not need your own OAuth app yet" : `Composio has no managed ${g.appName} app, so you must register your own`}
      </div>
      <p className="mt-1 text-stone-700">
        {managed
          ? `Composio provides a managed ${g.appName} OAuth app, so your users can connect today with no provider setup. Register your own app (this guide) when you need your brand on the consent screen, scopes beyond Composio's defaults, or your own rate-limit quota.`
          : `Register an app with ${g.appName} using the steps below, then create a custom auth config in Composio with its client ID and secret.`}{" "}
        <a
          className="text-accent underline decoration-accent/30 underline-offset-2"
          href={`https://docs.composio.dev/toolkits/${g.composio.slug}`}
          target="_blank"
          rel="noreferrer"
        >
          Composio toolkit docs
        </a>
      </p>
      {g.composio.redirectUri && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Redirect URI to register:</span>
          <code className="rounded bg-white px-2 py-1 font-mono text-xs">{g.composio.redirectUri}</code>
          <CopyButton text={g.composio.redirectUri} className="btn no-print !px-2 !py-0.5 !text-xs" />
        </div>
      )}
    </section>
  );
}

function TechRow({ label, value, copy, link }: { label: string; value: string; copy?: boolean; link?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="flex items-start gap-1.5">
        {link ? (
          <a href={value} target="_blank" rel="noreferrer" className="min-w-0 text-accent break-all hover:underline">
            {value.replace(/^https?:\/\//, "")}
          </a>
        ) : copy ? (
          <code className="min-w-0 font-mono text-xs break-all">{value}</code>
        ) : (
          <span className="text-stone-700">{value}</span>
        )}
        {copy && <CopyButton text={value} label="⧉" className="no-print shrink-0 text-xs text-muted hover:text-ink" />}
      </dd>
    </div>
  );
}

// Turns bare URLs in agent-written text into links.
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s).,;:])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all">
            {p}
          </a>
        ) : (
          p
        ),
      )}
    </>
  );
}
