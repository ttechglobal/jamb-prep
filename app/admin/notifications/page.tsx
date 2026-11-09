import { CalendarClock, Moon, Pause, Play, Sun } from "lucide-react";
import { setRemindersEnabled } from "@/app/admin/actions";
import { AdminPage } from "@/components/admin/gate";
import { ExamDateForm, TemplateForm } from "@/components/admin/forms";
import { NotificationPreview, sample } from "@/components/admin/notification-preview";
import { SendNowForm } from "@/components/admin/send-now-form";
import { Button } from "@/components/ui/button";
import { adminDb } from "@/lib/admin/auth";

const SLOTS = [
  {
    key: "morning",
    title: "Morning",
    time: "7:00 am",
    icon: Sun,
    kinds: [
      { kind: "morning_goal", label: "Students who set a target", when: "The usual morning message." },
      { kind: "morning_plain", label: "Students without a target", when: "Used when a student has no target set." },
      { kind: "morning_countdown", label: "Exam countdown", when: "Replaces the above within 60 days of the exam date: weekly, then daily in the last 14 days. Needs the exam date below." },
    ],
  },
  {
    key: "evening",
    title: "Evening",
    time: "6:00 pm",
    icon: Moon,
    kinds: [
      { kind: "evening_streak", label: "Streak at risk", when: "Students who haven't practised today and have a streak of 2+ days." },
      { kind: "evening_nudge", label: "Have you practised?", when: "Everyone else who hasn't practised today. Students who already practised get nothing." },
    ],
  },
] as const;

export default function AdminNotificationsPage() {
  return (
    <AdminPage>
      <Notifications />
    </AdminPage>
  );
}

function nextRun(now: Date) {
  // 7:00 and 18:00 Lagos are 06:00 and 17:00 UTC.
  for (const h of [6, 17]) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h));
    if (t > now) return { at: t, label: h === 6 ? "Morning" : "Evening" };
  }
  return { at: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 6)), label: "Morning" };
}

async function Notifications() {
  const db = adminDb();
  const [templates, log, settings, audience] = await Promise.all([
    db.from("reminder_templates").select("id, kind, title, body, active").order("created_at"),
    db.from("reminder_log").select("at, slot, devices, sent, skipped, removed, failed").order("at", { ascending: false }).limit(12),
    db.from("app_settings").select("exam_date, reminders_enabled").eq("id", 1).single(),
    db.rpc("reminder_audience"),
  ]);
  const people = (audience.data ?? []) as { user_id: string; full_name: string; practised_today: boolean }[];
  const students = [...new Map(people.map((p) => [p.user_id, { user_id: p.user_id, name: p.full_name, practisedToday: p.practised_today }])).values()];
  const devices = people.length;
  const enabled = settings.data?.reminders_enabled !== false;
  const lastAuto = log.data?.find((r) => r.slot !== "manual");
  const next = nextRun(new Date());
  const when = new Intl.DateTimeFormat("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-semibold">Notifications</h1>

      <section className="game-card flex flex-wrap items-center gap-4 p-4" aria-labelledby="auto-t">
        <span className={enabled ? "grid size-12 place-items-center rounded-2xl bg-success-soft text-success" : "grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"}>
          <CalendarClock className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="auto-t" className="text-lg font-semibold">
            Automatic reminders are {enabled ? "on" : "paused"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {enabled ? `Next: ${next.label.toLowerCase()} at ${when.format(next.at)}. ` : "Nothing is sent until you resume. "}
            {lastAuto
              ? `Last run: ${when.format(new Date(lastAuto.at))}, sent to ${lastAuto.sent}.`
              : "Nothing has run yet. Automatic sending starts once the reminder function is deployed."}
          </p>
          <p className="text-sm text-muted-foreground">
            {students.length} {students.length === 1 ? "student" : "students"} on {devices} {devices === 1 ? "device has" : "devices have"} reminders on. You don&apos;t need to do anything: it runs by itself twice a day.
          </p>
        </div>
        <form action={setRemindersEnabled}>
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <Button type="submit" variant="outline" size="lg">
            {enabled ? <Pause aria-hidden /> : <Play aria-hidden />}
            {enabled ? "Pause" : "Resume"}
          </Button>
        </form>
      </section>

      <section className="game-card p-4" aria-labelledby="now-t">
        <h2 id="now-t" className="text-lg font-semibold">Send a notification now</h2>
        <p className="mb-3 text-sm text-muted-foreground">For an announcement or a nudge to one student. It goes out straight away and is separate from the daily reminders.</p>
        <SendNowForm students={students} devices={devices} />
      </section>

      <section aria-labelledby="daily-t" className="space-y-3">
        <div>
          <h2 id="daily-t" className="text-lg font-semibold">The daily messages</h2>
          <p className="text-sm text-muted-foreground">
            Each student gets at most one message per run. Where a group has several messages, one is picked each day in turn. In your text, {"{name}"}, {"{target}"}, {"{streak}"} and {"{days}"} are replaced with the student&apos;s details.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {SLOTS.map(({ key, title, time, icon: Icon, kinds }) => (
            <div key={key} className="game-card p-4">
              <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Icon className="size-5 text-gold-ink" aria-hidden /> {title} · {time}
              </h3>
              <div className="mt-3 space-y-4">
                {kinds.map(({ kind, label, when: description }) => {
                  const list = templates.data?.filter((t) => t.kind === kind) ?? [];
                  const live = list.find((t) => t.active) ?? list[0];
                  return (
                    <div key={kind}>
                      <p className="font-semibold">{label}</p>
                      <p className="mb-2 text-sm text-muted-foreground">{description}</p>
                      {live ? <NotificationPreview title={sample(live.title)} body={sample(live.body)} /> : <p className="text-sm text-muted-foreground">No message yet.</p>}
                      <details className="mt-2">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-primary">
                          Edit messages ({list.length})
                        </summary>
                        <div className="mt-2 space-y-3">
                          {list.map((t) => (
                            <TemplateForm key={t.id} kind={kind} template={t} />
                          ))}
                          <TemplateForm kind={kind} />
                        </div>
                      </details>
                    </div>
                  );
                })}
              </div>
              {key === "morning" ? (
                <div className="mt-4 border-t-2 pt-3">
                  <ExamDateForm date={settings.data?.exam_date ?? null} />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="game-card p-4" aria-labelledby="hist-t">
        <h2 id="hist-t" className="text-lg font-semibold">What was sent</h2>
        {log.data?.length ? (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">When</th>
                  <th className="pr-3 font-medium">Type</th>
                  <th className="pr-3 font-medium">Sent</th>
                  <th className="pr-3 font-medium">Not needed</th>
                  <th className="pr-3 font-medium">Removed</th>
                  <th className="font-medium">Failed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {log.data.map((r) => (
                  <tr key={r.at}>
                    <td className="py-1.5 pr-3">{when.format(new Date(r.at))}</td>
                    <td className="pr-3 capitalize">{r.slot}</td>
                    <td className="pr-3 font-semibold">{r.sent}</td>
                    <td className="pr-3">{r.skipped}</td>
                    <td className="pr-3">{r.removed}</td>
                    <td>{r.failed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted-foreground">
              &ldquo;Not needed&rdquo; means nothing was due for that student, for example they had already practised. &ldquo;Removed&rdquo; means that device uninstalled the app or blocked notifications.
            </p>
          </div>
        ) : (
          <p className="mt-1 text-muted-foreground">Nothing has been sent yet.</p>
        )}
      </section>
    </div>
  );
}
