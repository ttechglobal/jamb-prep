"use client";

import { Bell, BellOff, ChevronRight, Clock, Loader2, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import { ALL_DAYS, DAY_LETTER, DAY_SHORT, MAX_STUDY_TIMES, WEEKDAYS, presetOf, problemWith, type Preset, type StudyTime } from "@/lib/study/days";
import { getStudyTimes, saveStudyTimes } from "@/lib/study/client";
import { cn } from "@/lib/utils";

/** A sensible time for a new study time that no other one uses. */
const freeTime = (times: StudyTime[]) => ["18:00", "07:00", "13:00", "21:00"].find((t) => !times.some((x) => x.time === t)) ?? "18:00";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "every", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "custom", label: "Pick days" },
];

/** Loads the student's study times, then shows the editor. */
export function StudyTimes() {
  const { isGuest } = useAppState();
  const [initial, setInitial] = useState<StudyTime[] | null>(null);

  useEffect(() => {
    if (isGuest) return;
    let live = true;
    getStudyTimes()
      .then((t) => live && setInitial(t))
      .catch(() => live && setInitial([]));
    return () => {
      live = false;
    };
  }, [isGuest]);

  if (isGuest || initial === null) return null;
  return <StudyTimesEditor initial={initial} save={saveStudyTimes} />;
}

/**
 * When the student wants to study. At each time they get a reminder, unless they have already practised that
 * day. Up to three times, each on the days they choose.
 */
export function StudyTimesEditor({ initial, save: persist }: { initial: StudyTime[]; save: (times: StudyTime[]) => Promise<void> }) {
  const pwa = usePwa();
  const [times, setTimes] = useState<StudyTime[]>(initial);
  const [saved, setSaved] = useState<StudyTime[]>(initial);
  // A time set to "Pick days" stays in that mode while its days are being picked, even if they match a preset.
  const [picking, setPicking] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(times) !== JSON.stringify(saved);
  const problem = problemWith(times);

  const update = (i: number, next: Partial<StudyTime>) => setTimes(times.map((t, k) => (k === i ? { ...t, ...next } : t)));

  async function save() {
    if (problem) return;
    setBusy(true);
    try {
      await persist(times);
      setSaved(times);
      toast.success(times.length === 0 ? "Study times cleared" : "Study times saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="study-times" className="game-card scroll-mt-20 p-4" aria-labelledby="study-times-title">
      <div className="flex items-center gap-2">
        <Clock className="size-5 text-primary" aria-hidden />
        <h2 id="study-times-title" className="text-lg font-semibold">
          My study times
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose when you want to study. We&apos;ll remind you then, unless you have already practised that day.
      </p>

      {times.length === 0 ? <p className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-sm">No study times yet. Add your first one.</p> : null}

      <ul className="mt-3 flex flex-col gap-3">
        {times.map((t, i) => {
          const preset = picking[i] ? "custom" : presetOf(t.days);
          return (
            <li key={i} className="rounded-xl border-2 p-3">
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`study-time-${i}`}>
                  Study time {i + 1}
                </label>
                <input
                  id={`study-time-${i}`}
                  type="time"
                  value={t.time}
                  onChange={(e) => update(i, { time: e.target.value })}
                  className="h-12 flex-1 rounded-xl border-2 bg-card px-3 font-display text-xl font-semibold focus-visible:border-primary focus-visible:outline-none"
                />
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label={`Remove study time ${i + 1}`}
                  onClick={() => {
                    setTimes(times.filter((_, k) => k !== i));
                    setPicking({});
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>

              <div role="group" aria-label="Days" className="mt-2.5 flex gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={preset === p.id}
                    onClick={() => {
                      if (p.id === "custom") {
                        setPicking({ ...picking, [i]: true });
                      } else {
                        setPicking({ ...picking, [i]: false });
                        update(i, { days: p.id === "every" ? ALL_DAYS : WEEKDAYS });
                      }
                    }}
                    className={cn(
                      "min-h-11 flex-1 rounded-xl border-2 px-2 text-sm font-semibold",
                      preset === p.id ? "border-primary bg-secondary text-primary" : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {preset === "custom" ? (
                <div role="group" aria-label="Pick the days" className="mt-2 grid grid-cols-7 gap-1.5">
                  {ALL_DAYS.map((d) => {
                    const on = t.days.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={DAY_SHORT[d - 1]}
                        onClick={() => update(i, { days: on ? t.days.filter((x) => x !== d) : [...t.days, d].sort((a, b) => a - b) })}
                        className={cn("grid min-h-11 place-items-center rounded-xl border-2 text-sm font-semibold", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                      >
                        {DAY_LETTER[d - 1]}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {times.length < MAX_STUDY_TIMES ? (
        <Button
          variant="outline"
          size="lg"
          className="mt-3 w-full"
          onClick={() => setTimes([...times, { time: freeTime(times), days: ALL_DAYS }])}
        >
          <Plus aria-hidden />
          Add a study time
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs text-muted-foreground">That is the most you can set: {MAX_STUDY_TIMES} study times.</p>
      )}

      {dirty && problem ? <p role="alert" className="mt-2 text-sm text-destructive">{problem}</p> : null}
      {dirty ? (
        <Button size="lg" className="mt-3 w-full" disabled={busy || Boolean(problem)} onClick={save}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save study times
        </Button>
      ) : null}

      {/* The reminders are notifications, so they only arrive on a device that has them switched on. */}
      {saved.length > 0 && pwa.reminders !== "on" ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-gold-soft p-3 text-sm text-gold-ink" role="status">
          <BellOff className="size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            {pwa.reminders === "off" && "Turn on notifications on this device, or the reminders can't reach you."}
            {pwa.reminders === "blocked" && "Notifications are blocked in your browser. Allow them for this site, then come back."}
            {pwa.reminders === "unsupported" && (pwa.needsIosSteps ? "On iPhone, add the app to your Home Screen first, then turn on notifications." : "This browser can't show reminders.")}
          </p>
          {pwa.reminders === "off" ? (
            <Button size="lg" disabled={pwa.busy} onClick={pwa.toggleReminders}>
              <Bell aria-hidden />
              Turn on
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** On the practice home: a short invitation to set study times, shown only until the student has set one. */
export function StudyTimesPrompt() {
  const { isGuest } = useAppState();
  const [none, setNone] = useState(false);

  useEffect(() => {
    if (isGuest) return;
    let live = true;
    getStudyTimes()
      .then((t) => live && setNone(t.length === 0))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isGuest]);

  if (isGuest || !none) return null;
  return (
    <Link href="/settings#study-times" className="order-3 game-card game-tap flex items-center gap-3 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink">
        <Clock className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.05rem] font-semibold leading-tight">Set your study times</span>
        <span className="block text-xs text-muted-foreground">Pick when you study and we&apos;ll remind you.</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}