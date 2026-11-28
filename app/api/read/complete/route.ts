import { adminDb } from "@/lib/admin/auth";
import { readCatalogue } from "@/lib/read/exl";
import { READ_XP } from "@/lib/read/xp";

/**
 * A student finished a note. XP is given once per lesson. The caller proves who they are with their sign-in
 * token, and the lesson must exist in EXL Learn's published catalogue, so ids cannot be made up to farm XP.
 */
export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  if (!token) return Response.json({ error: "sign_in" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { lessonId?: unknown } | null;
  const lessonId = typeof body?.lessonId === "string" ? body.lessonId : "";
  if (!/^[0-9a-f-]{36}$/i.test(lessonId)) return Response.json({ error: "bad_lesson" }, { status: 400 });

  const db = adminDb();
  const { data, error } = await db.auth.getUser(token);
  // Guests are anonymous sign-ins. XP belongs to real accounts.
  if (error || !data.user || data.user.is_anonymous) return Response.json({ error: "sign_in" }, { status: 401 });

  let known = false;
  try {
    known = (await readCatalogue()).subjects.some((s) => s.topics.some((t) => t.lessons.some((l) => l.id === lessonId)));
  } catch {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  if (!known) return Response.json({ error: "unknown_lesson" }, { status: 404 });

  const { data: result, error: rpcError } = await db.rpc("award_read", { p_user: data.user.id, p_lesson: lessonId, p_xp: READ_XP });
  if (rpcError) return Response.json({ error: "failed" }, { status: 500 });
  return Response.json(result);
}
