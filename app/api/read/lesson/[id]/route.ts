import { readLesson } from "@/lib/read/exl";

export async function GET(_req: Request, ctx: RouteContext<"/api/read/lesson/[id]">) {
  const { id } = await ctx.params;
  let lesson;
  try {
    lesson = await readLesson(id);
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  return lesson ? Response.json(lesson, { headers: { "cache-control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=86400" } }) : Response.json({ error: "not found" }, { status: 404 });
}
