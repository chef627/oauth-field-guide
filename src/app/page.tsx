import { GenerateForm } from "@/components/generate-form";
import { Library, type LibraryItem } from "@/components/library";
import { listGuides, loadCatalog } from "@/lib/store";

export const dynamic = "force-dynamic";

// Card-sized version of an estimate: "2-6 weeks (review queue); faster if…" -> "2-6 weeks".
const short = (s: string) => {
  const head = s.split(/[;(.]| — | - (?=[A-Z])/)[0].trim();
  return head.length <= 44 ? head : head.slice(0, 44).replace(/\s+\S*$/, "") + "…";
};

export default function Home() {
  const { apps } = loadCatalog();
  const guides = listGuides();
  const bySlug = new Map(guides.map((g) => [g.slug, g]));
  const summarize = (slug: string): LibraryItem["guide"] => {
    const g = bySlug.get(slug);
    return g
      ? { difficulty: g.verdict.difficulty, devReady: short(g.verdict.devReady.estimate), productionReady: short(g.verdict.productionReady.estimate), reviewed: g.review.status === "human_reviewed" }
      : null;
  };

  const items: LibraryItem[] = [
    ...apps.map((a) => ({ slug: a.slug, name: a.name, logo: a.logo, category: a.category, composioManaged: a.composioManaged, inCatalog: true, guide: summarize(a.slug) })),
    ...guides
      .filter((g) => !apps.some((a) => a.slug === g.slug))
      .map((g) => ({ slug: g.slug, name: g.appName, logo: g.logo, category: "other", composioManaged: null, inCatalog: false, guide: summarize(g.slug) })),
  ];

  return (
    <>
      <section className="py-12 sm:py-16">
        <p className="mb-3 text-sm font-medium text-accent">For developers shipping agent integrations</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
          Will your users be able to connect it next week, or in two months?
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Before users can connect an app, you may need your own OAuth app, and the provider may need to approve it. Look up an app to see the
          path, the real timeline, what blocks approval, and which steps an agent can do for you. Every claim is labeled with how we know it.
        </p>
        <div className="mt-8 max-w-2xl">
          <GenerateForm examples={["PandaDoc", "Calendly", "Xero"]} />
        </div>
      </section>

      <section className="mb-12 grid gap-3 md:grid-cols-3">
        {[
          {
            t: "1 · Do you even need your own app?",
            d: "If Composio manages an OAuth app for the provider, users can connect today. Your own app buys your brand on the consent screen, custom scopes and your own rate limits.",
          },
          {
            t: "2 · Dev-ready is not production-ready",
            d: "Most providers let you test with your own account in minutes. Letting any user connect can mean review, verification, user caps or a partner program.",
          },
          {
            t: "3 · Know what is evidence and what is a guess",
            d: "Steps are labeled Tested (our agent probed it live), Documented, Reported by developers, or Unverified, with sources attached.",
          },
        ].map((x) => (
          <div key={x.t} className="card p-4">
            <h2 className="text-sm font-semibold">{x.t}</h2>
            <p className="mt-1.5 text-sm text-muted">{x.d}</p>
          </div>
        ))}
      </section>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold tracking-tight">Library</h2>
        <p className="text-sm text-muted">
          {guides.length} guides ready · {apps.length} OAuth apps tracked
        </p>
      </div>
      <Library items={items} />
    </>
  );
}
