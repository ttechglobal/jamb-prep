// Sends the day's practice reminders. pg_cron calls this twice a day (see scripts/setup-reminders.mjs):
//   POST /functions/v1/send-reminders?slot=morning   (7:00 Lagos)
//   POST /functions/v1/send-reminders?slot=evening   (18:00 Lagos)
// The wording lives in the reminder_templates table and is edited from the admin page.
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type Kind = "morning_goal" | "morning_plain" | "morning_countdown" | "evening_streak" | "evening_nudge";
interface Template {
  kind: Kind;
  title: string;
  body: string;
}
interface Student {
  sub_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  first_name: string;
  target: number | null;
  streak: number;
  practised_today: boolean;
}

const lagosDay = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10); // Lagos is UTC+1 all year
const dayNumber = (d: Date) => Math.floor(Date.parse(lagosDay(d)) / 86_400_000);

const fill = (text: string, v: Record<string, string | number | null>) =>
  text.replace(/\{(\w+)\}/g, (m, k) => (v[k] === null || v[k] === undefined ? m : String(v[k])));

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("Unauthorized", { status: 401 });

  const slot = new URL(req.url).searchParams.get("slot");
  if (slot !== "morning" && slot !== "evening") return new Response("slot must be morning or evening", { status: 400 });

  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [audience, templates, settings] = await Promise.all([
    db.rpc("reminder_audience"),
    db.from("reminder_templates").select("kind, title, body").eq("active", true).order("created_at"),
    db.from("app_settings").select("exam_date, reminders_enabled").eq("id", 1).single(),
  ]);
  if (audience.error || templates.error) return new Response("Couldn't read data", { status: 500 });

  if (settings.data?.reminders_enabled === false) return Response.json({ slot, paused: true });

  const now = new Date();
  const examDate = settings.data?.exam_date as string | null | undefined;
  const days = examDate ? Math.round((Date.parse(examDate) - Date.parse(lagosDay(now))) / 86_400_000) : null;
  const countdownDay = days !== null && days >= 0 && days <= 60 && (days <= 14 || days % 7 === 0);

  // One template per kind per day, rotating through the active ones.
  const pick = (kind: Kind): Template | undefined => {
    const list = (templates.data as Template[]).filter((t) => t.kind === kind);
    return list.length ? list[dayNumber(now) % list.length] : undefined;
  };

  const choose = (s: Student): Template | undefined => {
    if (slot === "evening") {
      if (s.practised_today) return undefined; // never nag someone who already practised
      return s.streak >= 2 ? (pick("evening_streak") ?? pick("evening_nudge")) : pick("evening_nudge");
    }
    if (countdownDay) return pick("morning_countdown") ?? (s.target ? pick("morning_goal") : pick("morning_plain"));
    return s.target ? (pick("morning_goal") ?? pick("morning_plain")) : pick("morning_plain");
  };

  const students = (audience.data ?? []) as Student[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const gone: string[] = [];

  await Promise.all(
    students.map(async (s) => {
      const t = choose(s);
      if (!t) {
        skipped++;
        return;
      }
      const vars = { name: s.first_name, target: s.target, streak: s.streak, days };
      const payload = JSON.stringify({
        title: fill(t.title, vars),
        body: fill(t.body, vars),
        tag: slot,
        url: "/practice",
      });
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600 });
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.sub_id); // the student removed the app or revoked permission
        else failed++;
      }
    }),
  );

  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone);
  await db.from("reminder_log").insert({ slot, devices: students.length, sent, skipped, removed: gone.length, failed });

  return Response.json({ slot, devices: students.length, sent, skipped, removed: gone.length, failed });
});
