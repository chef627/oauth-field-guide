import { getGuide } from "@/lib/store";
import { guideToMarkdown } from "@/lib/markdown";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  return new Response(guideToMarkdown(guide, `${origin}/guides/${slug}`), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `inline; filename="${slug}-oauth-setup.md"`,
    },
  });
}
