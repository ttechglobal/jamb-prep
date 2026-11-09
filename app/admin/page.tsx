import { ArrowDownRight, ArrowUpRight, Lightbulb, Minus } from "lucide-react";
import Link from "next/link";
import { AdminPage } from "@/components/admin/gate";
import { DailyChart, type DayPoint } from "@/components/admin/daily-chart";
import { adminDb } from "@/lib/admin/auth";
import { MODE_LABEL } from "@/lib/engine/presets";
import { cn } from "@/lib/utils";

interface Overview {
  days: number;
  funnel: { step: string; visitors: number }[];
  daily: DayPoint[];
  modes: { mode: keyof typeof MODE_LABEL; started: number; completed: number; students: number }[];
  users: {
    members: number;
    joined: number;
    active_today: number;
    active_7d: number;
    practised_on_2plus_days: number;
    rounds_per_active_member: number | null;
    guests_in_period: number;
  };
  games: { game: string; started: number; completed: number; players: number; avg_stars: number | null }[];
  app: { install_accepted: number; reminders_enabled: number; devices_subscribed: number; students_subscribed: number };
}
interface Prev {
  joined: number;
  rounds: number;
  finished: number;
  active_members: number;
}

const PERIODS = [7, 14, 30, 90];
const GAME_NAME: Record<string, string> = { concord: "Concord" };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

export default function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  return (
    <AdminPage>
      <OverviewData searchParams={searchParams} />
    </AdminPage>
  );
}

async function OverviewData({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const asked = Number((await searchParams).days);
  const days = PERIODS.includes(asked) ? asked : 14;
  const db = adminDb();
  const [current, previous] = await Promise.all([db.rpc("admin_overview", { p_days: days }), db.rpc("admin_overview_prev", { p_days: days })]);
  if (current.error || !current.data) return <p role="alert">Couldn&apos;t load the numbers. Refresh to try again.</p>;
  const o = current.data as Overview;
  const prev = (previous.data ?? null) as Prev | null;

  const rounds = o.daily.reduce((n, d) => n + d.rounds, 0);
  const started = o.modes.reduce((n, m) => n + m.started, 0);
  const finished = o.modes.reduce((n, m) => n + m.completed, 0);
  const finishRate = pct(finished, started);
  const prevFinishRate = prev && prev.rounds > 0 ? pct(prev.finished, prev.rounds) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">Overview</h1>
        <nav aria-label="Period" className="ml-auto flex rounded-xl bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin?days=${p}`}
              aria-current={p === days ? "page" : undefined}
              className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-muted-foreground aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
            >
              {p}d
            </Link>
          ))}
        </nav>
      </div>

      <Insights o={o} prev={prev} rounds={rounds} finishRate={finishRate} />

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Card label="New members" value={o.users.joined} now={o.users.joined} before={prev?.joined} days={days} />
        <Card label="Rounds practised" value={rounds} now={rounds} before={prev?.rounds} days={days} />
        <Card label="Rounds finished" value={`${finishRate}%`} now={finishRate} before={prevFinishRate ?? undefined} days={days} unit="pts" />
        <Card label="Active this week" value={o.users.active_7d} note={`${o.users.active_today} today · ${o.users.members} ${o.users.members === 1 ? "member" : "members"} in all`} />
        <Card label="Came back" value={o.users.practised_on_2plus_days} note={`practised on 2+ days`} />
      </section>

      <section className="game-card p-4" aria-labelledby="daily-t">
        <h2 id="daily-t" className="text-lg font-semibold">Practice each day</h2>
        <div className="mt-2">
          <DailyChart data={o.daily} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Funnel
          title="Getting started"
          sub="From the landing page to a first finished round"
          steps={o.funnel.slice(0, 4)}
        />
        <Funnel title="Becoming a member" sub="From the sign-up page to practising as a member" steps={o.funnel.slice(4)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="game-card p-4" aria-labelledby="modes-t">
          <h2 id="modes-t" className="text-lg font-semibold">What people practise</h2>
          <p className="text-sm text-muted-foreground">
            <span className="mr-1 inline-block size-2.5 rounded-sm bg-brand-bright/35 align-middle" /> started
            <span className="mx-1 ml-3 inline-block size-2.5 rounded-sm bg-primary align-middle" /> finished
          </p>
          {o.modes.length ? (
            <ul className="mt-3 space-y-3">
              {o.modes.map((m) => (
                <li key={m.mode}>
                  <div className="flex items-baseline gap-2 text-sm">
                    <span className="font-semibold">{MODE_LABEL[m.mode] ?? m.mode}</span>
                    <span className="ml-auto text-muted-foreground">
                      {m.completed} of {m.started} finished ({pct(m.completed, m.started)}%) · {m.students} {m.students === 1 ? "student" : "students"}
                    </span>
                  </div>
                  <div className="mt-1 h-3 rounded-full bg-muted">
                    <div className="relative h-3 rounded-full bg-brand-bright/35" style={{ width: `${pct(m.started, Math.max(...o.modes.map((x) => x.started)))}%` }}>
                      <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct(m.completed, m.started)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-muted-foreground">No rounds in this period yet.</p>
          )}
        </section>

        <div className="space-y-5">
          <section className="game-card p-4" aria-labelledby="games-t">
            <h2 id="games-t" className="text-lg font-semibold">Games</h2>
            {o.games.length ? (
              <ul className="mt-2 divide-y">
                {o.games.map((g) => (
                  <li key={g.game} className="py-2">
                    <p className="font-semibold">{GAME_NAME[g.game] ?? g.game}</p>
                    <p className="text-sm text-muted-foreground">
                      {g.started} played · {g.completed} finished ({pct(g.completed, g.started)}%) · {g.players} players
                      {g.avg_stars !== null ? ` · ${g.avg_stars} stars on average` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-muted-foreground">Nobody has played a game in this period.</p>
            )}
          </section>

          <section className="game-card p-4" aria-labelledby="app-t">
            <h2 id="app-t" className="text-lg font-semibold">App and reminders</h2>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Mini label="Installed the app" value={o.app.install_accepted} hint={`last ${days} days`} />
              <Mini label="Turned reminders on" value={o.app.reminders_enabled} hint={`last ${days} days`} />
              <Mini label="Students with reminders" value={`${o.app.students_subscribed} of ${o.users.members}`} hint="right now" />
              <Mini label="Guests who practised" value={o.users.guests_in_period} hint={`last ${days} days`} />
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Insights({ o, prev, rounds, finishRate }: { o: Overview; prev: Prev | null; rounds: number; finishRate: number }) {
  const notes: string[] = [];

  const visitors = o.funnel[0]?.visitors ?? 0;
  if (visitors === 0 && (o.funnel[1]?.visitors ?? 0) === 0) {
    notes.push("Visitor numbers are still empty because tracking only started recently. They fill in as people arrive.");
  } else {
    let worst: { from: string; to: string; kept: number } | null = null;
    for (let i = 1; i < o.funnel.length; i++) {
      const a = o.funnel[i - 1].visitors;
      const b = o.funnel[i].visitors;
      if (a >= 3) {
        const kept = pct(b, a);
        if (!worst || kept < worst.kept) worst = { from: o.funnel[i - 1].step, to: o.funnel[i].step, kept };
      }
    }
    if (worst && worst.kept < 100) notes.push(`The biggest drop: only ${worst.kept}% go from "${worst.from}" to "${worst.to}".`);
  }

  if (o.modes.length) {
    const top = o.modes[0];
    notes.push(`${MODE_LABEL[top.mode]} is the most used, with ${top.started} rounds.`);
    const weak = o.modes.filter((m) => m.started >= 3).sort((a, b) => pct(a.completed, a.started) - pct(b.completed, b.started))[0];
    if (weak && pct(weak.completed, weak.started) < 60) notes.push(`Only ${pct(weak.completed, weak.started)}% of ${MODE_LABEL[weak.mode]} rounds get finished.`);
  }
  if (prev && prev.rounds > 0 && rounds !== prev.rounds) {
    const change = pct(Math.abs(rounds - prev.rounds), prev.rounds);
    notes.push(`Practice is ${rounds > prev.rounds ? "up" : "down"} ${change}% on the previous ${o.days} days.`);
  }
  if (o.users.members > 0 && o.app.students_subscribed < o.users.members / 2) {
    notes.push(`Only ${o.app.students_subscribed} of ${o.users.members} members have reminders on.`);
  }
  if (!o.games.length) notes.push("Nobody has played a game in this period.");
  if (!notes.length) return null;

  return (
    <section aria-label="What stands out" className="rounded-2xl border-2 border-gold/60 bg-gold-soft p-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-gold-ink">
        <Lightbulb className="size-5" aria-hidden /> What stands out
      </h2>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[0.95rem] text-gold-ink">
        {notes.slice(0, 5).map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </section>
  );
}

function Card({
  label,
  value,
  now,
  before,
  days,
  unit,
  note,
}: {
  label: string;
  value: number | string;
  now?: number;
  before?: number;
  days?: number;
  unit?: string;
  note?: string;
}) {
  const diff = now !== undefined && before !== undefined ? now - before : null;
  return (
    <div className="game-card p-3">
      <p className="text-sm font-semibold leading-tight text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold leading-none">{value}</p>
      {diff !== null ? (
        <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground")}>
          {diff > 0 ? <ArrowUpRight className="size-3.5" aria-hidden /> : diff < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
          {diff === 0 ? "Same as" : `${diff > 0 ? "+" : ""}${diff}${unit ? ` ${unit}` : ""} vs`} previous {days}d
        </p>
      ) : note ? (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <div>
      <dd className="font-display text-xl font-semibold leading-none">{value}</dd>
      <dt className="mt-1 font-medium leading-tight">{label}</dt>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Funnel({ title, sub, steps }: { title: string; sub: string; steps: { step: string; visitors: number }[] }) {
  const first = Math.max(1, steps[0]?.visitors ?? 0, ...steps.map((s) => s.visitors));
  return (
    <section className="game-card p-4" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{sub}</p>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => {
          const before = i > 0 ? steps[i - 1].visitors : null;
          return (
            <li key={s.step}>
              <div className="flex items-baseline gap-2 text-sm">
                <span className="font-medium">{s.step}</span>
                <span className="ml-auto font-display text-lg font-semibold leading-none">{s.visitors}</span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-muted">
                <div className="h-3 rounded-full bg-primary" style={{ width: `${Math.max(s.visitors ? 2 : 0, (s.visitors / first) * 100)}%` }} />
              </div>
              {before !== null && before > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {pct(s.visitors, before)}% of the step above continue{s.visitors < before ? ` (${before - s.visitors} dropped off)` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
