import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-sent events: replays everything the job has emitted so far, then streams live.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return new Response("Job not found (the server may have restarted).", { status: 404 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      send({ type: "meta", query: job.query, startedAt: job.startedAt });
      for (const e of job.events) send(e);
      if (job.status !== "running") return controller.close();

      const heartbeat = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      const listener = (e: { type: string }) => {
        send(e);
        if (e.type === "done" || e.type === "error") cleanup(true);
      };
      const cleanup = (close: boolean) => {
        clearInterval(heartbeat);
        job.listeners.delete(listener);
        if (close) controller.close();
      };
      job.listeners.add(listener);
      req.signal.addEventListener("abort", () => cleanup(false));
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
