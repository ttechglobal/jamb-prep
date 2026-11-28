import { readLesson } from "@/lib/read/exl";

export async function GET(_req: Request, ctx: RouteContext<"/api/read/lesson/[id]">) {
  const { id } = await ctx.params;
  const lesson = await readLesson(id);
  return lesson ? Response.json(lesson) : Response.json({ error: "not found" }, { status: 404 });
}
