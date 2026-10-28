// The guide format. GUIDE_JSON_SCHEMA is what the research agent must return (validated by the
// Claude CLI's --json-schema); Guide adds the metadata we attach after the run.

export type Difficulty = "easy" | "moderate" | "hard" | "gated";
export type Owner = "agent" | "agent_assisted" | "you";
export type Confidence = "tested" | "documented" | "reported" | "unverified";
export type SourceKind = "official" | "community" | "probe" | "composio";

export interface Step {
  title: string;
  detail: string;
  owner: Owner;
  url: string | null;
  confidence: Confidence;
  sourceIds: number[];
}

export interface Phase {
  title: string;
  goal: string;
  duration: string;
  waitTime: string | null;
  steps: Step[];
}

export interface AgentOutput {
  appName: string;
  website: string;
  summary: string;
  verdict: {
    difficulty: Difficulty;
    difficultyReason: string;
    devReady: { estimate: string; detail: string };
    productionReady: { estimate: string; detail: string; approvalRequired: boolean };
    handsOnEffort: string;
  };
  nextAction: string;
  accessPaths: { name: string; whenToUse: string; reviewRequired: boolean; timeline: string; limits: string }[];
  prerequisites: { item: string; detail: string; required: boolean; owner: Owner }[];
  phases: Phase[];
  scopes: { scope: string; purpose: string; sensitivity: "basic" | "sensitive" | "restricted"; reviewNote: string }[];
  blockers: { title: string; symptom: string; fix: string; confidence: Confidence; sourceIds: number[] }[];
  technical: {
    consoleUrl: string | null;
    docsUrl: string | null;
    authorizeUrl: string | null;
    tokenUrl: string | null;
    pkce: string;
    refreshTokens: string;
    redirectUriRules: string;
    notes: string;
  };
  agentHelp: { canDo: string[]; youMustDo: string[] };
  drafts: { title: string; purpose: string; content: string }[];
  sources: { id: number; title: string; url: string; kind: SourceKind }[];
  probes: { action: string; target: string; observed: string; conclusion: string }[];
  uncertainties: string[];
}

export interface CatalogApp {
  slug: string;
  name: string;
  logo: string | null;
  category: string;
  description: string;
  oauthSchemes: string[];
  composioManaged: boolean;
  otherAuthSchemes: string[];
  redirectUri: string | null;
  defaultScopes: string | null;
  toolCount: number;
}

export interface Correction {
  claim: string;
  finding: string;
  action: "corrected" | "confirmed" | "flagged";
  sourceUrl: string | null;
}

export interface Guide extends AgentOutput {
  slug: string;
  composio: Pick<CatalogApp, "slug" | "composioManaged" | "redirectUri" | "defaultScopes" | "oauthSchemes"> | null;
  logo: string | null;
  meta: {
    generatedAt: string;
    model: string;
    durationMs: number;
    toolCalls: number;
    costUsd: number | null;
    query: string;
  };
  review: {
    status: "agent_generated" | "human_reviewed";
    reviewedAt: string | null;
    summary: string | null;
    corrections: Correction[];
  };
}

const str = (description: string) => ({ type: "string", description });
const nullableStr = (description: string) => ({ type: ["string", "null"], description });
const ownerEnum = {
  type: "string",
  enum: ["agent", "agent_assisted", "you"],
  description:
    "agent = an AI agent can do it end-to-end without the developer's logins (research, drafting text, generating a policy page, building the auth URL, testing endpoints). " +
    "agent_assisted = an agent can drive it (e.g. browser automation filling a console form, or preparing everything to paste) but the developer must be logged in or approve. " +
    "you = only a human can do it (identity/business verification, legal agreements, payments, recording a demo, signing in with 2FA, talking to a partner manager).",
};
const confidenceEnum = {
  type: "string",
  enum: ["tested", "documented", "reported", "unverified"],
  description:
    "tested = you observed it directly with a probe tool in this run. documented = stated in the provider's official docs you fetched. " +
    "reported = only from community/third-party sources (forums, blogs, Stack Overflow). unverified = your inference or sources conflict.",
};
const sourceIds = { type: "array", items: { type: "integer" }, description: "ids from sources[] supporting this" };

const obj = (properties: Record<string, unknown>) => ({
  type: "object",
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});

export const GUIDE_JSON_SCHEMA = obj({
  appName: str("Canonical product name, e.g. 'Zoom'"),
  website: str("Provider homepage URL"),
  summary: str("2-3 sentences: what getting an OAuth app ready involves for this provider and the single biggest gotcha."),
  verdict: obj({
    difficulty: {
      type: "string",
      enum: ["easy", "moderate", "hard", "gated"],
      description:
        "easy = self-serve, any user can connect within a day, no review. moderate = self-serve to start but a light review/listing or config hurdle before broad use. " +
        "hard = mandatory review/verification/security assessment that takes weeks. gated = needs partner-program approval, a paid plan/contract, or business relationship that can be refused.",
    },
    difficultyReason: str("One sentence justifying the rating."),
    devReady: obj({
      estimate: str("Time until the developer can complete an OAuth flow with their own/test account, e.g. '15-30 min'"),
      detail: str("What 'working' means at this stage and its limits (test users, dev mode, single workspace)."),
    }),
    productionReady: obj({
      estimate: str("Time until ANY end user can connect, including review/approval wait, e.g. '2-6 weeks (review queue)'"),
      detail: str("What has to happen and what the wait depends on."),
      approvalRequired: { type: "boolean", description: "Is provider approval/review mandatory before arbitrary users can connect?" },
    }),
    handsOnEffort: str("Active developer time excluding waiting, e.g. '2-4 hours'"),
  }),
  nextAction: str("The single concrete first thing the developer should do now, with the URL if there is one."),
  accessPaths: {
    type: "array",
    description:
      "Distinct ways an app can be used/distributed (e.g. 'Private/internal app', 'Public unlisted app', 'Marketplace listing'), from least to most effort. 1-4 items.",
    items: obj({
      name: str("Path name"),
      whenToUse: str("Who this path is for"),
      reviewRequired: { type: "boolean" },
      timeline: str("Typical time including waits"),
      limits: str("User caps, rate limits, warnings shown to users, or 'None known'"),
    }),
  },
  prerequisites: {
    type: "array",
    description: "Everything needed before or during setup: account types, paid plans, verified domain, privacy policy, logo, demo video, business verification, etc.",
    items: obj({ item: str("Requirement"), detail: str("Specifics"), required: { type: "boolean" }, owner: ownerEnum }),
  },
  phases: {
    type: "array",
    description:
      "Ordered phases, typically: 1) Register the app, 2) Configure & test with your own account, 3) Go live / review (if any), 4) Ongoing maintenance (if any). 2-5 phases, 2-7 steps each.",
    items: obj({
      title: str("Phase title"),
      goal: str("What is true when this phase is done"),
      duration: str("Hands-on time for this phase"),
      waitTime: nullableStr("Provider wait time (review queue etc.) or null if none"),
      steps: {
        type: "array",
        items: obj({
          title: str("Imperative step title"),
          detail: str("Exact instructions: menu names, field values (use Composio's redirect URI where a redirect URI is needed), gotchas."),
          owner: ownerEnum,
          url: nullableStr("Direct link for this step, or null"),
          confidence: confidenceEnum,
          sourceIds,
        }),
      },
    }),
  },
  scopes: {
    type: "array",
    description: "The most relevant scopes/permissions for an AI agent use case (max 8), and how each affects review.",
    items: obj({
      scope: str("Scope string exactly as the provider spells it"),
      purpose: str("What it allows"),
      sensitivity: { type: "string", enum: ["basic", "sensitive", "restricted"], description: "restricted = triggers the provider's strictest review/security assessment" },
      reviewNote: str("Review implications, or 'No review needed'"),
    }),
  },
  blockers: {
    type: "array",
    description: "Things that commonly block or delay approval/setup and how to get past them. 3-7 items.",
    items: obj({ title: str("Blocker"), symptom: str("What the developer sees (error message, rejection reason)"), fix: str("How to proceed"), confidence: confidenceEnum, sourceIds }),
  },
  technical: obj({
    consoleUrl: nullableStr("Where apps are created"),
    docsUrl: nullableStr("Main OAuth documentation page"),
    authorizeUrl: nullableStr("Authorization endpoint"),
    tokenUrl: nullableStr("Token endpoint"),
    pkce: str("PKCE support/requirement"),
    refreshTokens: str("Refresh token behavior, access token lifetime, expiry/rotation rules"),
    redirectUriRules: str("Exact-match rules, https/localhost rules, number allowed, wildcard support"),
    notes: str("Other technical nuances (per-tenant URLs, OAuth 1.0a, app-level vs user-level tokens, etc.)"),
  }),
  agentHelp: obj({
    canDo: { type: "array", items: { type: "string" }, description: "Concrete things an AI agent can do for the developer in this setup." },
    youMustDo: { type: "array", items: { type: "string" }, description: "Concrete things only the developer can do." },
  }),
  drafts: {
    type: "array",
    description:
      "0-3 ready-to-paste texts the developer will need, e.g. scope justification for review, app description for a listing, reviewer test instructions. Empty if the provider needs none.",
    items: obj({ title: str("Draft name"), purpose: str("Where to paste it"), content: str("The draft text, with [PLACEHOLDERS] for the developer's specifics") }),
  },
  sources: {
    type: "array",
    description: "Every source used, numbered from 1. Include probe results as kind 'probe' with the probed URL.",
    items: obj({ id: { type: "integer" }, title: str("Page title"), url: str("URL"), kind: { type: "string", enum: ["official", "community", "probe", "composio"] } }),
  },
  probes: {
    type: "array",
    description: "Every first-hand probe you ran (discovery, authorize probe, http probe) and what it showed.",
    items: obj({ action: str("What you tried"), target: str("URL/domain"), observed: str("Raw observation"), conclusion: str("What it means for the developer") }),
  },
  uncertainties: {
    type: "array",
    items: { type: "string" },
    description: "What you could not verify, where sources conflict or are stale, and what only a real setup attempt with an account would confirm.",
  },
});
