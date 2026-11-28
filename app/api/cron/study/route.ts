import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/admin/auth";
import { sendPush } from "@/lib/push/send";

/**
 * Called every fifteen minutes by the database's scheduler (scripts/setup-study-reminders.mjs).
 * It sends two kinds of push:
 *  - a study-time reminder to each student whose chosen time has just come, unless they have already practised
 *  - a note to a study partner when the other has gone two days in a row without practising
 * The database decides who is due and records it as it does, so a repeated call sends nothing twice.
 */
type DueReminder = { uid: string; first_name: string; promise_kind: "sessions" | "questions" | null; promise_amount: number | null };
type DueAlert = { uid: string; about_uid: string; about_name: string };

const promiseText = (kind: DueReminder["promise_kind"], amount: number | null) => {
  if (!kind || !amount) return "Five questions is enough to keep your streak going.";
  if (kind === "sessions") return amount === 1 ? "Your promise today: one round." : `Your promise today: ${amount} rounds.`;
  return `Your promise today: ${amount} questions.`;
};

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("x-cron-secret") ?? "");
  const expected = Buffer.from(secret ?? "");
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const db = adminDb();
  const [reminders, alerts] = await Promise.all([db.rpc("study_reminders_due"), db.rpc("partner_alerts_due")]);
  if (reminders.error || alerts.error) return Response.json({ error: "failed" }, { status: 500 });

  const dueReminders = (reminders.data ?? []) as DueReminder[];
  const dueAlerts = (alerts.data ?? []) as DueAlert[];

  let pushes = 0;
  for (const r of dueReminders) {
    pushes += await sendPush([r.uid], {
      title: `Time to study, ${r.first_name}`,
      body: promiseText(r.promise_kind, r.promise_amount),
      url: "/practice",
      tag: "study-time",
    });
  }
  for (const a of dueAlerts) {
    pushes += await sendPush([a.uid], {
      title: `${a.about_name} hasn't studied for 2 days`,
      body: "Send a nudge to get them going again.",
      url: "/partners",
      tag: `partner-gap-${a.about_uid}`,
    });
  }

  return Response.json({ reminders: dueReminders.length, alerts: dueAlerts.length, pushes });
}