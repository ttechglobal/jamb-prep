"use client";

import Link from "next/link";
import { BookOpen, ChevronRight, Coffee, Flame, Gamepad2, Pause, Play, Route, Target, Timer } from "lucide-react";
import { toast } from "sonner";
import { TimerRing } from "@/components/study/timer-ring";
import { Button } from "@/components/ui/button";
import { PATH_ENABLED } from "@/lib/path/flag";
import { focusStreak, formatMinutes, lastDays } from "@/lib/study/focus-log";
import { BREAK_CHOICES, FOCUS_CHOICES, useStudyTimer } from "@/lib/study/session";
import { cn } from "@/lib/utils";

/** The study hub. Start a session here, then go and read, practise or follow the path while the timer runs. */
export default function StudyPage() {
  const t = useStudyTimer();
  if (!t.ready) return null;

  const days = lastDays(t.log, 7);
  const today = days[days.length - 1].seconds;
  const week = days.reduce((n, d) => n + d.seconds, 0);
  const streak = focusStreak(t.log);

  const finish = () => {
    const mins = Math.round(t.sessionSeconds / 60);
    t.end();
    toast.success(mins > 0 ? `Session done: ${mins} min focused` : "Session ended");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Study</h1>
      <p className="mt-0.5 text-muted-foreground">Focus in blocks, with breaks. Read, practise and play while the timer runs.</p>

      {t.phase === "idle" ? <Setup /> : null}
      {t.phase !== "idle" ? <Running onFinish={finish} /> : null}

      <section aria-label="Your focus time" className="game-card mt-5 p-4">
        <div className="grid grid-cols-3 divide-x-2 text-center">
          <Stat label="Today" value={formatMinutes(today)} />
          <Stat label="This week" value={formatMinutes(week)} />
          <Stat label="Day streak" value={String(streak)} icon={<Flame className="size-4 text-flame" aria-hidden />} />
        </div>
        <ul className="mt-4 flex h-20 items-end gap-2" aria-label="Minutes of focus each day this week">
          {days.map((d) => {
            const max = Math.max(...days.map((x) => x.seconds), 30 * 60);
            return (
              <li key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <span
                  className={cn("w-full rounded-md", d.seconds > 0 ? (d.today ? "bg-primary" : "bg-primary/55") : "bg-muted")}
                  style={{ height: `${Math.max(8, (d.seconds / max) * 100)}%`, minHeight: 6 }}
                  title={formatMinutes(d.seconds)}
                />
                <span className={cn("text-[0.7rem] font-semibold", d.today ? "text-foreground" : "text-muted-foreground")}>{d.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        After {4} focus blocks you get a long 15 minute break. Your focus time is kept on this device.
      </p>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="px-2">
      <p className="flex items-center justify-center gap-1 font-display text-xl font-semibold">
        {icon}
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Pick how long to focus and how long to rest, then start. */
function Setup() {
  const t = useStudyTimer();
  return (
    <section aria-label="Start a study session" className="game-card mt-5 p-5">
      <h2 className="font-display text-xl font-semibold">Start a study session</h2>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-muted-foreground">Focus for</legend>
        <div className="mt-2 grid grid-cols-5 gap-2">
          {FOCUS_CHOICES.map((m) => (
            <Choice key={m} on={t.focusMin === m} onClick={() => t.setFocusMin(m)} label={`${m} minutes`}>
              {m}
              <span className="block text-[0.65rem] font-medium">min</span>
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-muted-foreground">Break after each block</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {BREAK_CHOICES.map((m) => (
            <Choice key={m} on={t.breakMin === m} onClick={() => t.setBreakMin(m)} label={`${m} minute break`} tone="sky">
              {m} min
            </Choice>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-1">
        <span className="text-sm font-medium">Keep the screen on while I study</span>
        <input type="checkbox" checked={t.keepAwake} onChange={(e) => t.setKeepAwake(e.target.checked)} className="size-5 accent-primary" />
      </label>

      <Button size="xl" variant="gold" className="mt-3 w-full" onClick={t.start}>
        <Play className="fill-current" aria-hidden />
        Start {t.focusMin} minutes
      </Button>
    </section>
  );
}

function Choice({
  on,
  onClick,
  label,
  tone = "primary",
  children,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  tone?: "primary" | "sky";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "min-h-14 rounded-xl border-2 py-2 text-center font-display text-lg leading-tight font-semibold",
        on ? (tone === "sky" ? "border-sky bg-sky-soft text-sky" : "border-primary bg-secondary text-primary") : "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

/** A block in progress, paused, or waiting for the student to choose what comes next. */
function Running({ onFinish }: { onFinish: () => void }) {
  const t = useStudyTimer();
  const isBreak = t.phase === "break";
  const nextBreak = t.suggestedBreak;

  return (
    <section aria-label="Study timer" className="game-card mt-5 p-5">
      <TimerRing
        left={t.left}
        total={t.total}
        tone={t.finished ? "done" : isBreak ? "break" : "focus"}
        label={t.finished ? "Time's up" : t.paused ? "Paused" : isBreak ? "Break" : `Focus · block ${t.blocks + 1}`}
      />

      {t.finished ? (
        isBreak ? (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-center font-display text-lg font-semibold">Break over. Ready for the next block?</p>
            <Button size="xl" variant="gold" onClick={t.nextFocus}>
              <Play className="fill-current" aria-hidden />
              Focus for {t.focusMin} minutes
            </Button>
            <Button size="xl" variant="outline" onClick={onFinish}>
              Finish for today
            </Button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <p className="text-center font-display text-lg font-semibold">
              Block done{t.blocks > 1 ? `. That is ${t.blocks} so far` : ""}. Nice work.
            </p>
            <Button size="xl" variant="gold" onClick={() => t.startBreak()}>
              <Coffee aria-hidden />
              Take a {nextBreak} minute break
            </Button>
            <div role="group" aria-label="Keep going for" className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
              <span className="pr-1 text-sm font-semibold text-muted-foreground">Keep going</span>
              {([10, 15, 25] as const).map((m) => (
                <Button key={m} variant="outline" size="lg" onClick={() => t.extend(m)}>
                  +{m} min
                </Button>
              ))}
            </div>
            <Button variant="ghost" size="lg" onClick={onFinish}>
              Finish for today
            </Button>
          </div>
        )
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button size="xl" variant={t.running ? "outline" : "gold"} onClick={t.running ? t.pause : t.resume}>
              {t.running ? <Pause className="fill-current" aria-hidden /> : <Play className="fill-current" aria-hidden />}
              {t.running ? "Pause" : "Resume"}
            </Button>
            {isBreak ? (
              <Button size="xl" variant="outline" onClick={t.nextFocus}>
                Skip break
              </Button>
            ) : (
              <Button size="xl" variant="outline" onClick={onFinish}>
                End session
              </Button>
            )}
          </div>
          {isBreak ? (
            <p className="mt-4 rounded-xl bg-sky-soft px-3 py-2.5 text-center text-sm text-sky">
              Step away from the screen. Water, a stretch, some air. The timer will tell you when to come back.
            </p>
          ) : (
            <Launchers />
          )}
        </>
      )}
    </section>
  );
}

/** Where to go while the timer runs. The timer follows the student around the app. */
function Launchers() {
  const items = [
    ...(PATH_ENABLED ? [{ href: "/path", icon: Route, title: "Study path", text: "Your next topic", tint: "bg-violet-soft text-violet" }] : []),
    { href: "/read", icon: BookOpen, title: "Read", text: "Notes by topic", tint: "bg-sky-soft text-sky" },
    { href: "/practice/subject", icon: Target, title: "Practise", text: "Pick a subject", tint: "bg-secondary text-primary" },
    { href: "/games", icon: Gamepad2, title: "Games", text: "Learn by playing", tint: "bg-flame-soft text-flame" },
  ];
  return (
    <div className="mt-5">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Timer className="size-4" aria-hidden /> The timer keeps running while you:
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="game-card game-tap flex items-center gap-3 p-3">
              <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl", i.tint)}>
                <i.icon className="size-5" strokeWidth={2.3} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold leading-tight">{i.title}</span>
                <span className="block text-xs text-muted-foreground">{i.text}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
