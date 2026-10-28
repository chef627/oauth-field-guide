// Batch-generates library guides with the same agent the web app uses for live generation.
// Usage: npx tsx scripts/generate.mts github slack "Google Calendar"   [--concurrency 3]
import { runResearchAgent } from "@/lib/agent/run";
import { saveGuide } from "@/lib/store";

const argv = process.argv.slice(2);
const ci = argv.indexOf("--concurrency");
const concurrency = ci >= 0 ? Number(argv.splice(ci, 2)[1]) : 3;
const queue = [...argv];
if (!queue.length) {
  console.error("Usage: npx tsx scripts/generate.mts <app> [<app> ...] [--concurrency N]");
  process.exit(1);
}

async function worker() {
  for (let q = queue.shift(); q; q = queue.shift()) {
    const tag = `[${q}]`;
    try {
      const guide = await runResearchAgent(q, (e) => {
        if (e.type === "tool") console.log(tag, "→", e.label);
        else if (e.type === "status") console.log(tag, e.message);
        else if (e.type === "tool_result" && !e.ok) console.log(tag, "✗", e.summary);
      });
      saveGuide(guide);
      console.log(tag, `✓ saved data/guides/${guide.slug}.json (${guide.verdict.difficulty}, ${guide.meta.toolCalls} tool calls, ${Math.round(guide.meta.durationMs / 1000)}s, $${guide.meta.costUsd?.toFixed(2)})`);
    } catch (e) {
      console.error(tag, "FAILED:", (e as Error).message);
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, worker));
