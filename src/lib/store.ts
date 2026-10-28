import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { CatalogApp, Guide } from "@/lib/guide";

// Guides are plain JSON files so they can be reviewed in diffs and committed alongside the code.
const DATA_DIR = path.join(process.cwd(), "data");
const GUIDES_DIR = path.join(DATA_DIR, "guides");
const REVIEWS_DIR = path.join(DATA_DIR, "reviews");

interface ReviewFile {
  // The review only applies to the exact guide version that was checked; a re-research drops it.
  guideGeneratedAt: string;
  reviewedAt: string;
  summary: string;
  corrections: Guide["review"]["corrections"];
}

function withReview(guide: Guide): Guide {
  const file = path.join(REVIEWS_DIR, `${guide.slug}.json`);
  if (!existsSync(file)) return guide;
  const r = JSON.parse(readFileSync(file, "utf8")) as ReviewFile;
  if (r.guideGeneratedAt !== guide.meta.generatedAt) return guide;
  return { ...guide, review: { status: "human_reviewed", reviewedAt: r.reviewedAt, summary: r.summary, corrections: r.corrections } };
}

export function loadCatalog(): { fetchedAt: string; apps: CatalogApp[] } {
  return JSON.parse(readFileSync(path.join(DATA_DIR, "catalog.json"), "utf8"));
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\.(com|io|us|co|so|app|dev|net|org)$/, "")
    .replace(/[^a-z0-9]/g, "");

export function findCatalogApp(query: string): CatalogApp | null {
  const q = normalize(query);
  if (!q) return null;
  const apps = loadCatalog().apps;
  return apps.find((a) => normalize(a.slug) === q || normalize(a.name) === q) ?? null;
}

// Resolves a free-text query ("pandadoc.com", "Google Calendar") to an existing guide, if any.
export function findGuideSlug(query: string): string | null {
  const app = findCatalogApp(query);
  if (app) return getGuide(app.slug) ? app.slug : null;
  const q = normalize(query);
  if (!q) return null;
  return listGuides().find((g) => normalize(g.slug) === q || normalize(g.appName) === q)?.slug ?? null;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function listGuides(): Guide[] {
  if (!existsSync(GUIDES_DIR)) return [];
  return readdirSync(GUIDES_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => withReview(JSON.parse(readFileSync(path.join(GUIDES_DIR, f), "utf8")) as Guide));
}

export function getGuide(slug: string): Guide | null {
  if (!/^[a-z0-9_-]+$/.test(slug)) return null;
  const file = path.join(GUIDES_DIR, `${slug}.json`);
  return existsSync(file) ? withReview(JSON.parse(readFileSync(file, "utf8")) as Guide) : null;
}

export function saveGuide(guide: Guide): void {
  mkdirSync(GUIDES_DIR, { recursive: true });
  writeFileSync(path.join(GUIDES_DIR, `${guide.slug}.json`), JSON.stringify(guide, null, 2) + "\n");
}
