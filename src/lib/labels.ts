import type { Confidence, Difficulty, Owner } from "@/lib/guide";

export const DIFFICULTY: Record<Difficulty, { label: string; blurb: string }> = {
  easy: { label: "Easy", blurb: "Self-serve. Any user can connect within a day; no review." },
  moderate: { label: "Moderate", blurb: "Self-serve to start, with a light review, listing or config hurdle before broad use." },
  hard: { label: "Hard", blurb: "Mandatory review, verification or security assessment that takes weeks." },
  gated: { label: "Gated", blurb: "Needs partner approval, a paid tier or a business relationship that can be refused." },
};

export const OWNER: Record<Owner, { label: string; blurb: string }> = {
  agent: { label: "Agent", blurb: "An AI agent can do this without your logins." },
  agent_assisted: { label: "Agent-assisted", blurb: "An agent can drive it, but you must be logged in or approve." },
  you: { label: "You", blurb: "Only you can do this (identity, legal, payment, 2FA, demo video)." },
};

export const CONFIDENCE: Record<Confidence, { label: string; blurb: string }> = {
  tested: { label: "Tested", blurb: "Observed directly by the agent's probes during this run." },
  documented: { label: "Documented", blurb: "Stated in the provider's official docs, fetched during research." },
  reported: { label: "Reported", blurb: "From community sources only (forums, blogs, Q&A)." },
  unverified: { label: "Unverified", blurb: "Inferred, or sources conflict. Check before relying on it." },
};
