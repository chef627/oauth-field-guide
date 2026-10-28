import { LiveResearch } from "@/components/live-research";

export default async function GeneratePage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  return <LiveResearch jobId={jobId} />;
}
