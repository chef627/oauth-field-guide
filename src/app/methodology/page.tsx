import Link from "next/link";
import { listGuides } from "@/lib/store";
import { CONFIDENCE, DIFFICULTY, OWNER } from "@/lib/labels";
import { ConfidenceChip, DifficultyBadge, OwnerChip } from "@/components/badges";

export const dynamic = "force-dynamic";
export const metadata = { title: "How it works · OAuth Field Guide" };

export default function Methodology() {
  const guides = listGuides();
  const reviewed = guides.filter((g) => g.review.status === "human_reviewed");
  const corrections = reviewed.flatMap((g) => g.review.corrections.map((c) => ({ ...c, app: g.appName, slug: g.slug })));
  const tally = (a: string) => corrections.filter((c) => c.action === a).length;

  return (
    <div className="prose-tight max-w-3xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">How the guides are made</h1>
      <p className="mt-3 text-lg text-muted">
        Each guide is written by a research agent and backed by sources and live probes. A sample has been checked by hand. Here is what each label
        means and what the checks found.
      </p>

      <h2 className="mt-10 text-xl font-semibold">The research agent</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-stone-700">
        <li>
          <strong>Composio first.</strong> The app is matched against Composio&apos;s public toolkit catalog, which says whether a managed OAuth app exists (if
          so, you may not need your own) and gives the redirect URI to register.
        </li>
        <li>
          <strong>Official docs.</strong> The agent searches for and reads the provider&apos;s app-registration, scopes, review, verification and marketplace
          pages.
        </li>
        <li>
          <strong>Developer reports.</strong> Forums, Q&amp;A and issue trackers supply real review timelines and rejection reasons. These are labeled{" "}
          <em>Reported</em>, never <em>Documented</em>.
        </li>
        <li>
          <strong>Live probes.</strong> Through a small MCP server the agent calls (<code>agent/probe-server.mjs</code>), it fetches OAuth/OIDC discovery
          metadata, sends one authorization request with a deliberately unregistered client ID to see how the provider responds, and checks that console URLs
          exist. All probes are read-only: no accounts, no app registrations, no form submissions.
        </li>
        <li>
          <strong>Structured output.</strong> The agent returns a fixed JSON schema (verdict, phases, steps, blockers, scopes, drafts, sources, probes,
          uncertainties). The CLI validates it against that schema, and citations that point to sources not in the list are dropped.
        </li>
      </ol>
      <p className="mt-3 text-sm text-muted">
        Runtime: Claude Code in headless mode, limited to WebSearch, WebFetch and the probe tools. A guide takes about 2–5 minutes. Library guides and
        on-demand guides use the same code path.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Labels</h2>
      <h3 className="mt-4 font-semibold">Confidence: how we know</h3>
      <ul className="mt-2 space-y-2">
        {(Object.keys(CONFIDENCE) as (keyof typeof CONFIDENCE)[]).map((k) => (
          <li key={k} className="flex items-start gap-3">
            <span className="w-24 shrink-0">
              <ConfidenceChip value={k} />
            </span>
            <span className="text-sm text-stone-700">{CONFIDENCE[k].blurb}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-6 font-semibold">Owner: who does the step</h3>
      <ul className="mt-2 space-y-2">
        {(Object.keys(OWNER) as (keyof typeof OWNER)[]).map((k) => (
          <li key={k} className="flex items-start gap-3">
            <span className="w-28 shrink-0">
              <OwnerChip value={k} />
            </span>
            <span className="text-sm text-stone-700">{OWNER[k].blurb}</span>
          </li>
        ))}
      </ul>
      <h3 className="mt-6 font-semibold">Difficulty</h3>
      <ul className="mt-2 space-y-2">
        {(Object.keys(DIFFICULTY) as (keyof typeof DIFFICULTY)[]).map((k) => (
          <li key={k} className="flex items-start gap-3">
            <span className="w-24 shrink-0">
              <DifficultyBadge value={k} />
            </span>
            <span className="text-sm text-stone-700">{DIFFICULTY[k].blurb}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        Every guide gives two timelines: <strong>dev-ready</strong> (an OAuth flow works with your own or a test account) and <strong>production-ready</strong>{" "}
        (any user can connect, including the wait for approval). Mixing these up is the most common way developers misjudge an integration.
      </p>

      <h2 className="mt-10 text-xl font-semibold">Verification log</h2>
      <p className="mt-2 text-stone-700">
        {reviewed.length} of {guides.length} guides were checked claim by claim against official sources and independent probes after generation:{" "}
        <strong>{tally("confirmed")}</strong> claims confirmed, <strong>{tally("corrected")}</strong> corrected, <strong>{tally("flagged")}</strong> flagged as
        unresolvable without a logged-in account.
      </p>
      <div className="mt-4 space-y-6">
        {reviewed.map((g) => (
          <section key={g.slug} className="card p-4">
            <div className="flex items-center justify-between">
              <Link href={`/guides/${g.slug}`} className="font-semibold">
                {g.appName}
              </Link>
              <span className="text-xs text-muted">reviewed {g.review.reviewedAt?.slice(0, 10)}</span>
            </div>
            {g.review.summary && <p className="mt-1 text-sm text-stone-700">{g.review.summary}</p>}
            <ul className="mt-3 space-y-2 text-sm">
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
                  <span className="text-stone-700">
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
          </section>
        ))}
        {!reviewed.length && <p className="text-sm text-muted">No guides reviewed yet.</p>}
      </div>

      <h2 className="mt-10 text-xl font-semibold">Limits</h2>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-stone-700">
        <li>No provider console was logged into and no app was registered, so anything behind a login is documented or reported, never tested.</li>
        <li>Review timelines are inherently variable. Ranges come from provider statements and developer reports, not from submitting apps for review.</li>
        <li>Provider policies change. Every guide shows its research date, and &quot;Re-research&quot; regenerates it.</li>
      </ul>
    </div>
  );
}
