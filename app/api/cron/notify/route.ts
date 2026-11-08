import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { lagosDay, reminderFor, type Slot, type StudentSnapshot } from "@/lib/notifications/messages";

/**
 * Sends the day's reminders. A scheduler calls this twice a day (see vercel.json):
 *   GET /api/cron/notify?slot=morning
 *   GET /api/cron/notify?slot=evening
 * It needs the `Authorization: Bearer <CRON_SECRET>` header, which Vercel Cron adds by itself.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const slot = new URL(request.url).searchParams.get("slot");
  if (slot !== "morning" && slot !== "evening") return new Response("slot must be morning or evening", { status: 400 });

  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = process.env;
  if (!publicKey || !privateKey || !subject) return new Response("Push keys are not configured", { status: 500 });
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: subs, error } = await db.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth");
  if (error) return new Response("Couldn't read subscriptions", { status: 500 });
  if (!subs.length) return Response.json({ slot, students: 0, sent: 0, removed: 0 });

  const userIds = [...new Set(subs.map((s) => s.user_id))];
  const [profiles, progress, subjects] = await Promise.all([
    db.from("profiles").select("id, display_name").in("id", userIds),
    db.from("player_progress").select("user_id, current_streak, last_practice_day").in("user_id", userIds),
    db.from("student_subjects").select("user_id, target_score").in("user_id", userIds),
  ]);
  if (profiles.error || progress.error || subjects.error) return new Response("Couldn't read students", { status: 500 });

  const now = new Date();
  const today = lagosDay(now);
  const yesterday = lagosDay(new Date(now.getTime() - 86_400_000));
  const snapshots = new Map<string, StudentSnapshot>();
  for (const id of userIds) {
    const name = profiles.data.find((p) => p.id === id)?.display_name?.trim().split(/\s+/)[0] || "Hi";
    const p = progress.data.find((r) => r.user_id === id);
    const targets = subjects.data.filter((r) => r.user_id === id);
    const last = p?.last_practice_day as string | null | undefined;
    snapshots.set(id, {
      firstName: name,
      target: targets.length ? targets.reduce((sum, r) => sum + r.target_score, 0) : null,
      streak: last === today || last === yesterday ? (p?.current_streak ?? 0) : 0,
      practisedToday: last === today,
    });
  }

  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (sub) => {
      const reminder = reminderFor(slot as Slot, snapshots.get(sub.user_id)!, now);
      if (!reminder) return;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(reminder),
          { TTL: 6 * 60 * 60, urgency: "normal" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(sub.id); // the student removed the app or revoked permission
      }
    }),
  );
  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);

  return Response.json({ slot, students: userIds.length, sent, removed: gone.length });
}
