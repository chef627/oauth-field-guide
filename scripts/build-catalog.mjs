// Builds data/catalog.json: the 100 OAuth apps the library covers, enriched with
// Composio's public toolkit metadata (managed vs bring-your-own OAuth app, redirect URI, default scopes).
// Usage: node scripts/build-catalog.mjs
import { writeFileSync } from "node:fs";

const SOURCE = "https://docs.composio.dev/data/toolkits.json";

// Hand-picked: widely requested apps across categories, weighted toward apps where
// Composio has NO managed OAuth app (the developer must register their own).
const SLUGS = `github gitlab bitbucket slack discord microsoft_teams zoom webex gmail googlecalendar googledrive
googlesheets googledocs youtube google_analytics googleads google_search_console outlook one_drive share_point excel
dynamics365 linkedin facebook instagram reddit twitter twitch pinterest tiktok tiktok_ads snapchat notion confluence
jira asana linear clickup trello monday basecamp wrike todoist airtable smartsheet miro figma canva box dropbox
docusign sign_now boldsign dropbox_sign hubspot salesforce pipedrive zoho attio freshsales intercom zendesk front
help_scout gorgias shopify stripe square quickbooks xero freshbooks gusto deel workday netsuite mailchimp klaviyo kit
getresponse calendly cal typeform eventbrite gong servicenow pagerduty sentry datadog vercel digital_ocean webflow
wix wordpress_com contentful spotify ramp brex vimeo clover epic_games`
  .split(/\s+/)
  .filter(Boolean);

const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`Failed to fetch ${SOURCE}: ${res.status}`);
const toolkits = await res.json();
const bySlug = new Map(toolkits.map((t) => [t.slug, t]));

// User-delegated OAuth only: S2S_OAUTH2 (client credentials) never shows a consent screen to end users.
const isOAuth = (s) => ["OAUTH1", "OAUTH2", "DCR_OAUTH"].includes(s);
const catalog = SLUGS.map((slug) => {
  const t = bySlug.get(slug);
  if (!t) throw new Error(`Unknown toolkit slug: ${slug}`);
  const oauthSchemes = (t.authSchemes ?? []).filter(isOAuth);
  if (!oauthSchemes.length) throw new Error(`${slug} has no OAuth scheme`);
  const managed = (t.composioManagedAuthSchemes ?? []).filter(isOAuth);
  const oauthDetail = (t.authConfigDetails ?? []).find((d) => isOAuth(d.mode));
  const optional = oauthDetail?.fields?.auth_config_creation?.optional ?? [];
  const field = (name) => optional.find((f) => f.name === name)?.default ?? null;
  return {
    slug,
    name: t.name,
    logo: t.logo,
    category: t.category ?? "other",
    description: t.description,
    oauthSchemes,
    composioManaged: managed.length > 0,
    otherAuthSchemes: (t.authSchemes ?? []).filter((s) => !isOAuth(s)),
    redirectUri: field("oauth_redirect_uri"),
    defaultScopes: field("scopes"),
    toolCount: t.toolCount,
  };
});

writeFileSync(
  new URL("../data/catalog.json", import.meta.url),
  JSON.stringify({ source: SOURCE, fetchedAt: new Date().toISOString(), apps: catalog }, null, 2),
);
const managed = catalog.filter((a) => a.composioManaged).length;
console.log(`Wrote ${catalog.length} apps (${managed} Composio-managed, ${catalog.length - managed} bring-your-own)`);
