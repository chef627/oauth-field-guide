#!/usr/bin/env node
// MCP server (stdio) that gives the research agent first-hand evidence instead of only reading docs.
// Every tool is read-only and unauthenticated: it never registers apps, submits forms, or sends credentials.
// Probes record what a provider actually does today (live endpoints, discovery metadata, how the
// authorize endpoint reacts to an unregistered client), which the guide labels as "tested".
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { lookup } from "node:dns/promises";
import net from "node:net";

const COMPOSIO_REDIRECT_URI = "https://backend.composio.dev/api/v1/auth-apps/add";
const PROBE_CLIENT_ID = "oauth-guide-probe-unregistered-client";
const USER_AGENT = "Mozilla/5.0 (compatible; OAuthSetupGuideProbe/1.0; +read-only research)";
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 6;

// ---------- network safety: public http(s) hosts only ----------

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Not a valid URL: ${raw}`);
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http(s) URLs can be probed");
  const addrs = await lookup(url.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error(`Refusing to probe non-public host ${url.hostname}`);
  }
  return url;
}

// Follows redirects manually so each hop is checked and the chain can be reported.
async function probe(rawUrl, { method = "GET" } = {}) {
  const chain = [];
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      method,
      redirect: "manual",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = res.headers.get("location");
    chain.push({ url: url.toString(), status: res.status, location: location ?? undefined });
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, url).toString();
      continue;
    }
    const contentType = res.headers.get("content-type") ?? "";
    const body = method === "HEAD" ? "" : (await res.text()).slice(0, 400_000);
    return { chain, final: chain.at(-1), contentType, body, headers: res.headers };
  }
  return { chain, final: chain.at(-1), contentType: "", body: "", headers: new Headers(), tooManyRedirects: true };
}

function htmlSummary(body, contentType) {
  if (!contentType.includes("html")) return { title: null, text: body.slice(0, 1200) };
  const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, " ") ?? null;
  const text = body
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return { title, text: text.slice(0, 1200) };
}

const json = (value) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const fail = (message) => ({ content: [{ type: "text", text: `Probe failed: ${message}` }], isError: true });

// ---------- tools ----------

const server = new McpServer({ name: "oauth-probe", version: "1.0.0" });

server.registerTool(
  "http_probe",
  {
    description:
      "Fetch a public URL without credentials and report the redirect chain, final status, page title and a text excerpt. " +
      "Use it to confirm a developer console or docs URL exists, see whether it requires login, or read the raw error a provider returns.",
    inputSchema: { url: z.string().describe("Absolute http(s) URL"), method: z.enum(["GET", "HEAD"]).optional() },
  },
  async ({ url, method }) => {
    try {
      const r = await probe(url, { method });
      const { title, text } = htmlSummary(r.body, r.contentType);
      return json({
        redirectChain: r.chain,
        finalStatus: r.final?.status,
        finalUrl: r.final?.url,
        contentType: r.contentType,
        title,
        excerpt: text,
        wwwAuthenticate: r.headers.get("www-authenticate") ?? undefined,
        tooManyRedirects: r.tooManyRedirects || undefined,
      });
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  "oauth_discovery",
  {
    description:
      "Look for OAuth 2.0 / OpenID Connect discovery metadata (RFC 8414 / OIDC) on a provider's domain and common auth subdomains. " +
      "Reports authorization/token endpoints, PKCE methods, supported scopes and whether dynamic client registration (registration_endpoint) is advertised.",
    inputSchema: {
      domain: z.string().describe("Provider domain, e.g. 'zoom.us' or 'login.example.com'"),
      extra_hosts: z.array(z.string()).optional().describe("Additional hostnames to try, e.g. 'auth.example.com'"),
    },
  },
  async ({ domain, extra_hosts = [] }) => {
    const base = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
    const hosts = [...new Set([base, `www.${base}`, `auth.${base}`, `login.${base}`, `accounts.${base}`, `api.${base}`, `oauth.${base}`, ...extra_hosts])];
    const paths = ["/.well-known/openid-configuration", "/.well-known/oauth-authorization-server"];
    const attempts = await Promise.all(
      hosts.flatMap((h) =>
        paths.map(async (p) => {
          const url = `https://${h}${p}`;
          try {
            const r = await probe(url);
            if (r.final?.status !== 200) return { url, status: r.final?.status };
            const doc = JSON.parse(r.body);
            if (!doc.authorization_endpoint && !doc.token_endpoint) return { url, status: 200, note: "JSON without OAuth endpoints" };
            return {
              url,
              status: 200,
              found: {
                issuer: doc.issuer,
                authorization_endpoint: doc.authorization_endpoint,
                token_endpoint: doc.token_endpoint,
                registration_endpoint: doc.registration_endpoint,
                code_challenge_methods_supported: doc.code_challenge_methods_supported,
                grant_types_supported: doc.grant_types_supported,
                token_endpoint_auth_methods_supported: doc.token_endpoint_auth_methods_supported,
                scopes_supported: Array.isArray(doc.scopes_supported) ? doc.scopes_supported.slice(0, 60) : undefined,
              },
            };
          } catch (e) {
            return { url, error: e.message.slice(0, 120) };
          }
        }),
      ),
    );
    // Many hosts serve the same document; keep one entry per authorization endpoint.
    const seen = new Set();
    const found = attempts.filter((a) => {
      if (!a.found) return false;
      const key = a.found.authorization_endpoint ?? a.found.token_endpoint;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return json({
      summary: found.length
        ? `Discovery metadata found at ${found.map((f) => f.url).join(", ")}`
        : "No discovery metadata found on the hosts tried. Endpoints must come from the provider's docs.",
      found,
      notFound: attempts.filter((a) => !a.found).map((a) => `${a.url} -> ${a.status ?? a.error ?? a.note}`),
    });
  },
);

server.registerTool(
  "oauth_authorize_probe",
  {
    description:
      "Send one authorization request (response_type=code) with a deliberately UNREGISTERED client_id and Composio's redirect URI, " +
      "then report how the provider responds (status, redirects, error codes/messages). This confirms the authorize URL is live and shows " +
      "which error a developer sees before their app is registered. It never logs in or creates anything.",
    inputSchema: {
      authorize_url: z.string().describe("The provider's authorization endpoint"),
      scope: z.string().optional().describe("Space-separated scopes to include, if the provider requires one"),
      extra_params: z.record(z.string(), z.string()).optional().describe("Any extra query params the docs say are required"),
    },
  },
  async ({ authorize_url, scope, extra_params = {} }) => {
    try {
      const u = new URL(authorize_url);
      u.searchParams.set("response_type", "code");
      u.searchParams.set("client_id", PROBE_CLIENT_ID);
      u.searchParams.set("redirect_uri", COMPOSIO_REDIRECT_URI);
      u.searchParams.set("state", "probe123");
      if (scope) u.searchParams.set("scope", scope);
      for (const [k, v] of Object.entries(extra_params)) u.searchParams.set(k, v);
      const r = await probe(u.toString());
      const { title, text } = htmlSummary(r.body, r.contentType);
      const errorParams = {};
      for (const hop of r.chain) {
        if (!hop.location) continue;
        try {
          const loc = new URL(hop.location, hop.url);
          for (const key of ["error", "error_description", "error_code", "message"]) {
            const v = loc.searchParams.get(key);
            if (v) errorParams[key] = v;
          }
        } catch {}
      }
      return json({
        requestedUrl: u.toString(),
        redirectChain: r.chain,
        finalStatus: r.final?.status,
        finalUrl: r.final?.url,
        errorParamsInRedirects: Object.keys(errorParams).length ? errorParams : undefined,
        title,
        excerpt: text,
        interpretationHint:
          "A provider-specific error about an invalid/unknown client, or a redirect to a login page, means the endpoint is live. " +
          "A 404 or DNS failure means the URL is wrong. Redirecting back to the Composio redirect_uri with an error means the provider did not validate redirect_uri before the client.",
      });
    } catch (e) {
      return fail(e.message);
    }
  },
);

let composioCache;
server.registerTool(
  "composio_lookup",
  {
    description:
      "Search Composio's public toolkit catalog (docs.composio.dev/data/toolkits.json) for an app. Reports its auth schemes and whether " +
      "Composio provides a managed OAuth app (if not, the developer must register their own), plus the redirect URI and default scopes Composio uses.",
    inputSchema: { query: z.string().describe("App name, slug or domain") },
  },
  async ({ query }) => {
    try {
      if (!composioCache) {
        const res = await fetch("https://docs.composio.dev/data/toolkits.json", { signal: AbortSignal.timeout(20_000) });
        composioCache = await res.json();
      }
      const q = query.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[./]/)[0].replace(/[^a-z0-9]/g, "");
      const matches = composioCache
        .filter((t) => {
          const slug = t.slug.replace(/_/g, "");
          const name = t.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          return slug === q || name === q || slug.startsWith(q) || name.startsWith(q);
        })
        .slice(0, 5)
        .map((t) => {
          const oauth = (t.authConfigDetails ?? []).find((d) => /OAUTH/.test(d.mode));
          const optional = oauth?.fields?.auth_config_creation?.optional ?? [];
          return {
            slug: t.slug,
            name: t.name,
            authSchemes: t.authSchemes,
            composioManagedAuthSchemes: t.composioManagedAuthSchemes ?? [],
            redirectUri: optional.find((f) => f.name === "oauth_redirect_uri")?.default,
            defaultScopes: optional.find((f) => f.name === "scopes")?.default,
            docsUrl: `https://docs.composio.dev/toolkits/${t.slug}`,
          };
        });
      return json(matches.length ? { matches } : { matches: [], note: "Not in Composio's catalog: developer must build the integration and register their own OAuth app." });
    } catch (e) {
      return fail(e.message);
    }
  },
);

await server.connect(new StdioServerTransport());
