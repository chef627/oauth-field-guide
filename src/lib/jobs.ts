import { randomUUID } from "node:crypto";
import { runResearchAgent, type AgentEvent } from "@/lib/agent/run";
import { saveGuide } from "@/lib/store";

export interface Job {
  id: string;
  query: string;
  startedAt: number;
  status: "running" | "done" | "error";
  events: (AgentEvent & { at: number })[];
  listeners: Set<(e: AgentEvent & { at: number }) => void>;
}

// In-memory registry: a job keeps running if the browser disconnects, and a reconnecting
// viewer replays its events. Kept on globalThis so dev-server hot reloads don't drop it.
const g = globalThis as unknown as { __jobs?: Map<string, Job> };
const jobs = (g.__jobs ??= new Map());

const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_JOBS ?? 3);

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}

export function startJob(query: string): Job {
  const key = query.trim().toLowerCase();
  const existing = [...jobs.values()].find((j) => j.status === "running" && j.query.trim().toLowerCase() === key);
  if (existing) return existing;
  if ([...jobs.values()].filter((j) => j.status === "running").length >= MAX_CONCURRENT) {
    throw new Error(`Already researching ${MAX_CONCURRENT} apps. Try again in a couple of minutes.`);
  }

  const job: Job = { id: randomUUID(), query: query.trim(), startedAt: Date.now(), status: "running", events: [], listeners: new Set() };
  jobs.set(job.id, job);
  const emit = (e: AgentEvent) => {
    const stamped = { ...e, at: Date.now() };
    job.events.push(stamped);
    for (const l of job.listeners) l(stamped);
  };

  runResearchAgent(job.query, emit)
    .then((guide) => {
      saveGuide(guide);
      job.status = "done";
      emit({ type: "done", slug: guide.slug });
    })
    .catch((err: Error) => {
      job.status = "error";
      emit({ type: "error", message: err.message });
    });

  return job;
}
