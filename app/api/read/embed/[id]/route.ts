import { readEmbedHtml } from "@/lib/read/exl";

/**
 * One Read & Learn lesson as a page for a sandboxed frame. It goes through here, not straight from EXL, so it is
 * cached on our side and so a later free or paid check has one place to live.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/read/embed/[id]">) {
  const { id } = await ctx.params;
  const html = await readEmbedHtml(id);
  if (!html) return new Response("Not found", { status: 404 });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The lesson page runs scripts, so keep it in a sandbox with no access to this app.
      "content-security-policy": "sandbox allow-scripts",
      "referrer-policy": "no-referrer",
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
