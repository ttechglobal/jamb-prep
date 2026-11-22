import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { adminDb } from "@/lib/admin/auth";

/**
 * The partner actions that end in a push notification. The database function does the real work as
 * the signed-in student (so every rule is enforced there); this route then tells the other person.
 * It never trusts the browser for who the message is for: the database function names the recipient.
 */

type Action =
  | { action: "request"; code: string }
  | { action: "respond"; id: string; accept: boolean }
  | { action: "nudge"; id: string }
  | { action: "practised" };

type Outcome = { to: string | string[] | null; from: string | null; status?: string };

const PUSH = {
  request: (from: string) => ({ title: `${from} wants to study with you`, body: "Open JAMBprep to accept.", url: "/partners", tag: "partner-request" }),
  joined: (from: string) => ({ title: `${from} is now your study partner`, body: "Keep each other going.", url: "/practice", tag: "partner-joined" }),
  nudge: (from: string) => ({ title: `${from} nudged you`, body: "Time to practise. Five questions is enough.", url: "/practice", tag: "partner-nudge" }),
  practised: (from: string) => ({ title: `${from} has practised today`, body: "Your turn.", url: "/practice", tag: "partner-practised" }),
};

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: Action;
  try {
    body = (await request.json()) as Action;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Acts as the student: the database sees their id and applies its own rules.
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let result;
  switch (body.action) {
    case "request":
      result = await db.rpc("request_partner", { p_code: String(body.code ?? "") });
      break;
    case "respond":
      result = await db.rpc("respond_partner", { p_id: String(body.id ?? ""), p_accept: body.accept === true });
      break;
    case "nudge":
      result = await db.rpc("send_nudge", { p_partnership: String(body.id ?? "") });
      break;
    case "practised":
      result = await db.rpc("notify_practised");
      break;
    default:
      return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (result.error) {
    const code = result.error.message;
    const known = ["invalid_code", "own_code", "already_partners", "too_many_partners", "not_found", "already_practised", "already_nudged", "account_required"];
    return Response.json({ error: known.includes(code) ? code : "failed" }, { status: known.includes(code) ? 400 : 500 });
  }

  const out = result.data as Outcome;
  const recipients = (Array.isArray(out.to) ? out.to : out.to ? [out.to] : []).filter(Boolean);
  if (recipients.length > 0 && out.from) {
    const kind =
      body.action === "request" ? (out.status === "active" ? "joined" : "request")
      : body.action === "respond" ? "joined"
      : body.action === "nudge" ? "nudge"
      : "practised";
    // Awaited so the push is sent before the function ends, but never allowed to fail the request.
    await push(recipients, PUSH[kind](out.from)).catch(() => {});
  }

  return Response.json({ ok: true, status: out.status ?? null });
}

async function push(userIds: string[], payload: { title: string; body: string; url: string; tag: string }) {
  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv, VAPID_SUBJECT: subject } = process.env;
  if (!pub || !priv || !subject) return;
  webpush.setVapidDetails(subject, pub, priv);

  const admin = adminDb();
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
  const gone: string[] = [];
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.id);
      }
    }),
  );
  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
}
