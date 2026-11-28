"use client";

import { Bell, BellOff, CalendarCheck, ChevronRight, Clock, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/lib/app-state";
import {
  ALL_DAYS,
  DAY_LETTER,
  DAY_SHORT,
  MAX_STUDY_TIMES,
  TIME_OF_DAY,
  WEEKDAYS,
  daysLabel,
  nextStudyLabel,
  presetOf,
  problemWith,
  timeLabel,
  type Preset,
  type StudyTime,
} from "@/lib/study/days";
import { getStudyTimes, saveStudyTimes } from "@/lib/study/client";
import { cn } from "@/lib/utils";

const FIRST: StudyTime = { time: "19:00", days: ALL_DAYS };

/** A quick-pick time that no other study time already uses. */
const freeTime = (times: StudyTime[]) => TIME_OF_DAY.find((q) => !times.some((x) => x.time === q.time))?.time ?? "18:00";

const PRESETS: { id: Preset; label: string }[] = [
  { id: "every", label: "Every day" },
  { id: "weekdays", label: "Weekdays" },
  { id: "custom", label: "Pick days" },
];

/** Loads the student's study times, then shows them. Edit (or arriving with ?edit=study) opens the editor. */
export function StudyTimes({ startEditing = false }: { startEditing?: boolean }) {
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

  useEffect(() => {
    if (startEditing && initial) document.getElementById("study-times")?.scrollIntoView({ block: "start" });
  }, [startEditing, initial]);

  if (isGuest || initial === null) return null;
  return <StudyTimesPanel initial={initial} save={saveStudyTimes} startEditing={startEditing} />;
}

/**
 * When the student wants to study. At each time they get a reminder, unless they have already practised that
 * day. Up to three times, each on the days they choose.
 */
export function StudyTimesPanel({
  initial,
  save: persist,
  startEditing = false,
}: {
  initial: StudyTime[];
  save: (times: StudyTime[]) => Promise<void>;
  startEditing?: boolean;
}) {
  const pwa = usePwa();
  const [saved, setSaved] = useState<StudyTime[]>(initial);
  const [times, setTimes] = useState<StudyTime[]>(initial.length ? initial : [FIRST]);
  const [editing, setEditing] = useState(startEditing);
  // A time set to "Pick days" stays in that mode while its days are being picked, even if they match a preset.
  const [picking, setPicking] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  const problem = problemWith(times);
  const update = (i: number, next: Partial<StudyTime>) => setTimes(times.map((t, k) => (k === i ? { ...t, ...next } : t)));

  function open() {
    setTimes(saved.length ? saved : [FIRST]);
    setPicking({});
    setEditing(true);
  }

  async function save(next: StudyTime[]) {
    if (problemWith(next)) return;
    setBusy(true);
    try {
      await persist(next);
      setSaved(next);
      setEditing(false);
      toast.success(next.length === 0 ? "Study times cleared" : "Study times saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  const next = nextStudyLabel(saved);

  return (
    <section id="study-times" className="game-card scroll-mt-20 p-4" aria-labelledby="study-times-title">
      <div className="flex items-center gap-2">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink">
          <Clock className="size-5" />
        </span>
        <h2 id="study-times-title" className="min-w-0 flex-1 text-lg font-semibold">
          My study times
        </h2>
        {!editing && saved.length > 0 ? (
          <button
            type="button"
            onClick={open}
            aria-label="Edit study times"
            className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Pencil className="size-4" aria-hidden /> Edit
          </button>
        ) : null}
        {editing && saved.length > 0 ? (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="-mr-2 inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        ) : null}
      </div>

      {!editing && saved.length === 0 ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            Studying at the same time every day makes it a habit. Pick what suits you and we&apos;ll remind you then.
          </p>
          <ol className="mt-3 flex flex-col gap-2 text-sm">
            {["Pick a time of day.", "Choose which days.", "We remind you, unless you have already practised that day."].map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary font-display text-sm font-semibold text-secondary-foreground">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <Button size="lg" variant="gold" className="mt-4 w-full" onClick={open}>
            <Plus aria-hidden />
            Set my study times
          </Button>
        </>
      ) : null}

      {!editing && saved.length > 0 ? (
        <>
          {next ? (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-secondary-foreground">
              <CalendarCheck className="size-4 shrink-0" aria-hidden />
              Next reminder: {next}
            </p>
          ) : null}
          <ul className="mt-2 divide-y-2">
            {saved.map((t) => (
              <li key={t.time} className="flex items-center gap-3 py-2.5">
                <span className="w-24 shrink-0 font-display text-lg font-semibold">{timeLabel(t.time)}</span>
                <span className="min-w-0 flex-1 text-sm text-muted-foreground">{daysLabel(t.days)}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {editing ? (
        <>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ll remind you at each time, unless you have already practised that day.
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {times.map((t, i) => {
              const preset = picking[i] ? "custom" : presetOf(t.days);
              return (
                <li key={i} className="rounded-2xl border-2 p-3">
                  <div className="flex items-center gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-muted-foreground">Study time {i + 1}</p>
                    {times.length > 1 ? (
                      <Button
                        variant="ghost"
                        size="icon-lg"
                        aria-label={`Remove study time ${i + 1}`}
                        className="-my-1.5 -mr-1.5"
                        onClick={() => {
                          setTimes(times.filter((_, k) => k !== i));
                          setPicking({});
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    ) : null}
                  </div>

                  <div role="group" aria-label="When in the day" className="mt-1.5 grid grid-cols-2 gap-2">
                    {TIME_OF_DAY.map((q) => {
                      const on = t.time === q.time;
                      return (
                        <button
                          key={q.time}
                          type="button"
                          aria-pressed={on}
                          onClick={() => update(i, { time: q.time })}
                          className={cn(
                            "flex min-h-14 flex-col justify-center rounded-xl border-2 px-3 text-left",
                            on ? "border-primary bg-secondary" : "hover:bg-muted",
                          )}
                        >
                          <span className={cn("text-sm font-semibold", on ? "text-primary" : "text-foreground")}>{q.label}</span>
                          <span className="text-xs text-muted-foreground">{timeLabel(q.time)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <label className="mt-2.5 flex items-center gap-3 text-sm font-medium text-muted-foreground" htmlFor={`study-time-${i}`}>
                    <span className="flex-1">Or choose an exact time</span>
                    <input
                      id={`study-time-${i}`}
                      type="time"
                      value={t.time}
                      onChange={(e) => update(i, { time: e.target.value })}
                      className="h-11 w-36 rounded-xl border-2 bg-card px-3 font-display text-lg font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none"
                    />
                  </label>

                  <div role="group" aria-label="Days" className="mt-3 flex gap-1.5">
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
                            className={cn(
                              "grid min-h-11 place-items-center rounded-xl border-2 text-sm font-semibold",
                              on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {DAY_LETTER[d - 1]}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <p className="mt-3 text-center text-sm font-medium">
                    {t.days.length ? `${timeLabel(t.time)} · ${daysLabel(t.days)}` : "Pick at least one day"}
                  </p>
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
              Add another study time
            </Button>
          ) : null}

          {problem ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          <Button size="lg" className="mt-3 w-full" disabled={busy || Boolean(problem)} onClick={() => save(times)}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save study times
          </Button>
          {saved.length > 0 ? (
            <Button variant="ghost" size="lg" className="mt-1 w-full text-muted-foreground" disabled={busy} onClick={() => save([])}>
              Clear all study times
            </Button>
          ) : null}
        </>
      ) : null}

      {/* The reminders are notifications, so they only arrive on a device that has them switched on. */}
      {saved.length > 0 && pwa.reminders !== "on" ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-gold-soft p-3 text-sm text-gold-ink" role="status">
          <BellOff className="size-5 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">
            {pwa.reminders === "off" && "Turn on notifications on this device, or the reminders can't reach you."}
            {pwa.reminders === "blocked" && "Notifications are blocked in your browser. Allow them for this site, then come back."}
            {pwa.reminders === "unsupported" &&
              (pwa.needsIosSteps ? "On iPhone, add the app to your Home Screen first, then turn on notifications." : "This browser can't show reminders.")}
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

/** On the practice home: the next study time, or a short invitation to set one. Tapping opens the editor. */
export function StudyTimesPrompt() {
  const { isGuest } = useAppState();
  const [times, setTimes] = useState<StudyTime[] | null>(null);

  useEffect(() => {
    if (isGuest) return;
    let live = true;
    getStudyTimes()
      .then((t) => live && setTimes(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isGuest]);

  if (isGuest || times === null) return null;
  const next = nextStudyLabel(times);
  return (
    <Link href="/settings?edit=study" className="game-card game-tap flex items-center gap-3 p-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold-ink">
        <Clock className="size-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[1.05rem] font-semibold leading-tight">
          {times.length === 0 ? "Set your study times" : "Your study times"}
        </span>
        <span className="block text-xs text-muted-foreground">
          {times.length === 0 ? "Pick when you study and we'll remind you." : next ? `Next reminder: ${next}` : "Tap to change them."}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
