import type { Guide } from "@/lib/guide";
import { CONFIDENCE, DIFFICULTY, OWNER } from "@/lib/labels";

const sentence = (s: string) => s.replace(/\.+$/, "");
const cite = (ids: number[]) => (ids.length ? " " + ids.map((i) => `[${i}]`).join("") : "");

export function guideToMarkdown(g: Guide, url: string): string {
  const out: string[] = [];
  const push = (...lines: string[]) => out.push(...lines);

  push(`# ${g.appName}: OAuth app setup guide`, "");
  push(`> ${g.summary}`, "");
  push(`- **Difficulty:** ${DIFFICULTY[g.verdict.difficulty].label}. ${g.verdict.difficultyReason}`);
  push(`- **Dev-ready (works with your own account):** ${sentence(g.verdict.devReady.estimate)}. ${g.verdict.devReady.detail}`);
  push(`- **Production-ready (any user can connect):** ${sentence(g.verdict.productionReady.estimate)}. ${g.verdict.productionReady.detail}`);
  push(`- **Approval required:** ${g.verdict.productionReady.approvalRequired ? "Yes" : "No"}`);
  push(`- **Hands-on effort:** ${g.verdict.handsOnEffort}`);
  if (g.composio) {
    push(
      `- **Composio:** ${g.composio.composioManaged ? "Managed OAuth app available, so your own app is optional" : "No managed app, so you must register your own"}. Redirect URI: \`${g.composio.redirectUri}\``,
    );
  }
  push("", `**Start here:** ${g.nextAction}`, "");

  if (g.accessPaths.length) {
    push("## Ways to ship", "", "| Path | When | Review | Timeline | Limits |", "|---|---|---|---|---|");
    for (const p of g.accessPaths) push(`| ${p.name} | ${p.whenToUse} | ${p.reviewRequired ? "Yes" : "No"} | ${p.timeline} | ${p.limits} |`);
    push("");
  }

  if (g.prerequisites.length) {
    push("## Before you start", "");
    for (const p of g.prerequisites) push(`- [ ] **${p.item}**${p.required ? "" : " (optional)"}: ${p.detail} _(${OWNER[p.owner].label})_`);
    push("");
  }

  push("## Steps", "");
  g.phases.forEach((ph, i) => {
    push(`### ${i + 1}. ${ph.title}`, "", `_${ph.goal}_ · Hands-on: ${ph.duration}${ph.waitTime ? ` · Wait: ${ph.waitTime}` : ""}`, "");
    for (const s of ph.steps) {
      push(`- [ ] **${s.title}** (${OWNER[s.owner].label}, ${CONFIDENCE[s.confidence].label.toLowerCase()}${cite(s.sourceIds)})`);
      push(`  ${s.detail}${s.url ? ` <${s.url}>` : ""}`);
    }
    push("");
  });

  if (g.scopes.length) {
    push("## Scopes", "", "| Scope | Purpose | Sensitivity | Review |", "|---|---|---|---|");
    for (const s of g.scopes) push(`| \`${s.scope}\` | ${s.purpose} | ${s.sensitivity} | ${s.reviewNote} |`);
    push("");
  }

  push("## If you get blocked", "");
  for (const b of g.blockers) push(`- **${b.title}.** _Symptom:_ ${b.symptom} _Fix:_ ${b.fix}${cite(b.sourceIds)}`);
  push("");

  push("## What an agent can do vs. what you must do", "", "**Agent can:**");
  for (const s of g.agentHelp.canDo) push(`- ${s}`);
  push("", "**You must:**");
  for (const s of g.agentHelp.youMustDo) push(`- ${s}`);
  push("");

  const t = g.technical;
  push("## Technical reference", "");
  if (t.consoleUrl) push(`- Console: ${t.consoleUrl}`);
  if (t.docsUrl) push(`- Docs: ${t.docsUrl}`);
  if (t.authorizeUrl) push(`- Authorize URL: \`${t.authorizeUrl}\``);
  if (t.tokenUrl) push(`- Token URL: \`${t.tokenUrl}\``);
  push(`- PKCE: ${t.pkce}`, `- Refresh tokens: ${t.refreshTokens}`, `- Redirect URIs: ${t.redirectUriRules}`);
  if (t.notes) push(`- Notes: ${t.notes}`);
  push("");

  for (const d of g.drafts) push(`## Draft: ${d.title}`, "", `_${d.purpose}_`, "", "```", d.content, "```", "");

  push("## Evidence", "");
  if (g.probes.length) {
    push("**Probes run by the agent:**");
    for (const p of g.probes) push(`- ${p.action} (\`${p.target}\`): ${p.observed} → ${p.conclusion}`);
    push("");
  }
  if (g.uncertainties.length) {
    push("**Not verified:**");
    for (const u of g.uncertainties) push(`- ${u}`);
    push("");
  }
  if (g.review.corrections.length) {
    push(`**Human review (${g.review.reviewedAt?.slice(0, 10)}):** ${g.review.summary ?? ""}`);
    for (const c of g.review.corrections) push(`- _${c.action}:_ ${c.claim} → ${c.finding}${c.sourceUrl ? ` (${c.sourceUrl})` : ""}`);
    push("");
  }
  push("**Sources:**");
  for (const s of g.sources) push(`${s.id}. [${s.title}](${s.url}) (${s.kind})`);
  push("", "---", `Generated ${g.meta.generatedAt.slice(0, 10)} by a research agent (${g.meta.model}, ${g.meta.toolCalls} tool calls). Live version: ${url}`);
  return out.join("\n");
}
