import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { GUIDE_JSON_SCHEMA, type AgentOutput, type Guide } from "@/lib/guide";
import { findCatalogApp, slugify } from "@/lib/store";
import { SYSTEM_PROMPT, buildTaskPrompt } from "@/lib/agent/prompt";

export type AgentEvent =
  | { type: "status"; message: string }
  | { type: "tool"; id: string; kind: "search" | "read" | "probe" | "composio"; label: string }
  | { type: "tool_result"; id: string; ok: boolean; summary: string }
  | { type: "thought"; text: string }
  | { type: "done"; slug: string }
  | { type: "error"; message: string };

const MODEL = process.env.AGENT_MODEL ?? "sonnet";
const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
const TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS ?? 10 * 60_000);
const PROBE_SERVER = path.join(process.cwd(), "agent", "probe-server.mjs");

function describeTool(name: string, input: Record<string, unknown>): { kind: "search" | "read" | "probe" | "composio"; label: string } {
  const s = (k: string) => String(input[k] ?? "");
  switch (name) {
    case "WebSearch":
      return { kind: "search", label: `Searching the web: “${s("query")}”` };
    case "WebFetch":
      return { kind: "read", label: `Reading ${s("url").replace(/^https?:\/\//, "")}` };
    case "mcp__probe__oauth_discovery":
      return { kind: "probe", label: `Probing OAuth discovery metadata on ${s("domain")}` };
    case "mcp__probe__oauth_authorize_probe":
      return { kind: "probe", label: `Test-firing an authorization request at ${s("authorize_url").replace(/^https?:\/\//, "")} with an unregistered client` };
    case "mcp__probe__http_probe":
      return { kind: "probe", label: `Checking ${s("url").replace(/^https?:\/\//, "")} is live` };
    case "mcp__probe__composio_lookup":
      return { kind: "composio", label: `Looking up “${s("query")}” in Composio’s toolkit catalog` };
    default:
      return { kind: "read", label: name };
  }
}

function resultSummary(content: unknown): string {
  const text = Array.isArray(content)
    ? content.map((c) => (typeof c === "object" && c && "text" in c ? String((c as { text: unknown }).text) : "")).join(" ")
    : String(content ?? "");
  // Probe tools return JSON; show the observation a human cares about instead of the raw payload.
  try {
    const j = JSON.parse(text);
    if (j.summary) return String(j.summary).slice(0, 220);
    if (j.finalStatus !== undefined) {
      const err = j.errorParamsInRedirects ? ` · error=${Object.values(j.errorParamsInRedirects).join(" ")}` : "";
      return `HTTP ${j.finalStatus}${j.title ? ` · “${j.title}”` : ""}${err} · ${String(j.finalUrl ?? "").replace(/^https?:\/\//, "").slice(0, 90)}`;
    }
    if (Array.isArray(j.matches)) {
      return j.matches.length
        ? j.matches.map((m: { name: string; authSchemes: string[]; composioManagedAuthSchemes: string[] }) => `${m.name}: ${m.authSchemes.join("/")}${m.composioManagedAuthSchemes.length ? " (managed)" : ""}`).join(" · ")
        : "Not in Composio's catalog";
    }
  } catch {}
  return text.replace(/\s+/g, " ").trim().slice(0, 220);
}

// Apps outside the catalog have no Composio logo; the site's favicon is a good-enough stand-in.
function faviconFor(website: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(website).hostname}&sz=128`;
  } catch {
    return null;
  }
}

function sanityCheck(out: AgentOutput): void {
  const missing = (["appName", "summary", "verdict", "phases", "sources"] as const).filter((k) => !out?.[k]);
  if (missing.length) throw new Error(`Agent output missing ${missing.join(", ")}`);
  const ids = new Set(out.sources.map((s) => s.id));
  // Drop dangling citations rather than show links to nothing.
  for (const phase of out.phases) for (const step of phase.steps) step.sourceIds = step.sourceIds.filter((id) => ids.has(id));
  for (const b of out.blockers) b.sourceIds = b.sourceIds.filter((id) => ids.has(id));
}

/**
 * Runs the research agent (Claude Code in headless mode, restricted to web search/fetch and the
 * read-only probe MCP server) and returns the finished guide. Progress is reported through onEvent.
 */
export async function runResearchAgent(
  query: string,
  onEvent: (e: AgentEvent) => void,
  signal?: AbortSignal,
): Promise<Guide> {
  const app = findCatalogApp(query);
  const today = new Date().toISOString().slice(0, 10);
  onEvent({
    type: "status",
    message: app
      ? `Matched “${query}” to ${app.name} in the catalog (${app.composioManaged ? "Composio-managed OAuth available" : "bring-your-own OAuth app"}). Starting research…`
      : `“${query}” is not in the 100-app catalog. Researching it from scratch…`,
  });

  const mcpConfig = JSON.stringify({ mcpServers: { probe: { command: process.execPath, args: [PROBE_SERVER] } } });
  const args = [
    "-p",
    buildTaskPrompt(query, app, today),
    "--output-format", "stream-json",
    "--verbose",
    "--model", MODEL,
    "--system-prompt", SYSTEM_PROMPT,
    "--tools", "WebSearch,WebFetch",
    "--allowedTools", "WebSearch,WebFetch,mcp__probe",
    "--mcp-config", mcpConfig,
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--json-schema", JSON.stringify(GUIDE_JSON_SCHEMA),
  ];

  // Run from an empty temp dir so no project files or CLAUDE.md leak into the research context.
  const cwd = mkdtempSync(path.join(os.tmpdir(), "oauth-guide-"));
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const started = Date.now();
  let toolCalls = 0;
  const child = spawn(CLAUDE_BIN, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const kill = () => child.kill("SIGTERM");
  signal?.addEventListener("abort", kill);
  const timer = setTimeout(kill, TIMEOUT_MS);

  let stderr = "";
  child.stderr.on("data", (d) => (stderr = (stderr + d.toString()).slice(-4000)));

  const result = await new Promise<{ output: AgentOutput; costUsd: number | null }>((resolve, reject) => {
    let buffer = "";
    let final: { output: AgentOutput; costUsd: number | null } | null = null;
    let failure: string | null = null;

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line) continue;
        let evt;
        try {
          evt = JSON.parse(line);
        } catch {
          continue;
        }
        if (evt.type === "assistant") {
          for (const c of evt.message?.content ?? []) {
            if (c.type === "tool_use" && c.name !== "StructuredOutput") {
              toolCalls++;
              onEvent({ type: "tool", id: c.id, ...describeTool(c.name, c.input ?? {}) });
            } else if (c.type === "tool_use") {
              onEvent({ type: "status", message: "Writing the guide…" });
            } else if (c.type === "text" && c.text?.trim()) {
              onEvent({ type: "thought", text: c.text.trim().slice(0, 600) });
            }
          }
        } else if (evt.type === "user") {
          for (const c of evt.message?.content ?? []) {
            if (c?.type === "tool_result") onEvent({ type: "tool_result", id: c.tool_use_id, ok: !c.is_error, summary: resultSummary(c.content) });
          }
        } else if (evt.type === "result") {
          if (evt.subtype === "success" && evt.structured_output) {
            final = { output: evt.structured_output, costUsd: evt.total_cost_usd ?? null };
          } else {
            failure = `Agent finished without a guide (${evt.subtype}). ${evt.result ?? ""}`.trim();
          }
        }
      }
    });

    child.on("error", (e) => reject(new Error(`Could not start the Claude CLI (${CLAUDE_BIN}): ${e.message}`)));
    child.on("close", (code) => {
      if (final) return resolve(final);
      if (signal?.aborted) return reject(new Error("Cancelled"));
      if (Date.now() - started >= TIMEOUT_MS) return reject(new Error(`Agent timed out after ${TIMEOUT_MS / 1000}s`));
      reject(new Error(failure ?? `Claude CLI exited with code ${code}. ${stderr.slice(-500)}`));
    });
  }).finally(() => {
    clearTimeout(timer);
    signal?.removeEventListener("abort", kill);
    rmSync(cwd, { recursive: true, force: true });
  });

  sanityCheck(result.output);
  return {
    ...result.output,
    slug: app?.slug ?? slugify(result.output.appName),
    logo: app?.logo ?? faviconFor(result.output.website),
    composio: app
      ? { slug: app.slug, composioManaged: app.composioManaged, redirectUri: app.redirectUri, defaultScopes: app.defaultScopes, oauthSchemes: app.oauthSchemes }
      : null,
    meta: {
      generatedAt: new Date().toISOString(),
      model: MODEL,
      durationMs: Date.now() - started,
      toolCalls,
      costUsd: result.costUsd,
      query,
    },
    review: { status: "agent_generated", reviewedAt: null, summary: null, corrections: [] },
  };
}
