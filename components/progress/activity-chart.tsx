"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Day = { day: string; questions: number; rounds: number };
type Range = "week" | "lastWeek" | "14" | "30";

const RANGES: { id: Range; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "lastWeek", label: "Last week" },
  { id: "14", label: "Last 14 days" },
  { id: "30", label: "Last 30 days" },
];

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LETTER = ["S", "M", "T", "W", "T", "F", "S"];

// Days are plain dates ("2026-11-23"), so they are handled in UTC and never shift with the time zone.
const parse = (day: string) => new Date(`${day}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(new Date(parse(day).getTime() + n * 86_400_000));
/** Monday of the week a date falls in. */
const mondayOf = (day: string) => addDays(day, -((parse(day).getUTCDay() + 6) % 7));

type Bar = { day: string; questions: number | null; label: string };

/**
 * Questions answered each day. The week views always run Monday to Sunday, so a day stays in the same
 * place all week and the days still to come are left empty. The longer views are the days up to today.
 */
export function ActivityChart() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [range, setRange] = useState<Range>("week");

  useEffect(() => {
    let live = true;
    supabase()
      .rpc("get_activity", { p_days: 30 })
      .then(({ data, error }) => {
        if (live && !error && Array.isArray(data)) setDays(data as Day[]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!days || days.length === 0) return null;

  const byDay = new Map(days.map((d) => [d.day, d.questions]));
  const today = days[days.length - 1].day;

  let bars: Bar[];
  if (range === "week" || range === "lastWeek") {
    const monday = addDays(mondayOf(today), range === "week" ? 0 : -7);
    bars = WEEKDAY.map((label, i) => {
      const day = addDays(monday, i);
      return { day, label, questions: day > today ? null : (byDay.get(day) ?? 0) };
    });
  } else {
    const count = Number(range);
    bars = days.slice(-count).map((d) => ({ day: d.day, label: LETTER[parse(d.day).getUTCDay()], questions: d.questions }));
  }

  const values = bars.map((b) => b.questions ?? 0);
  const max = Math.max(...values, 1);
  const total = values.reduce((s, v) => s + v, 0);
  const counted = bars.filter((b) => b.questions !== null);
  const active = counted.filter((b) => (b.questions ?? 0) > 0).length;
  const showLabels = bars.length <= 14;

  return (
    <section aria-labelledby="activity-title" className="game-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="activity-title" className="font-display text-lg font-semibold">
            Practice each day
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {total === 0
              ? "No practice in this period yet."
              : `${total} ${total === 1 ? "question" : "questions"} on ${active} of ${counted.length} ${counted.length === 1 ? "day" : "days"}.`}
          </p>
        </div>
        <label className="sr-only" htmlFor="activity-range">
          Period
        </label>
        <select
          id="activity-range"
          value={range}
          onChange={(e) => setRange(e.target.value as Range)}
          className="h-11 shrink-0 rounded-xl border-2 bg-card px-2.5 text-sm font-semibold focus-visible:border-primary focus-visible:outline-none"
        >
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <ol className={cn("mt-4 flex h-32 items-end", bars.length > 14 ? "gap-0.5" : "gap-1.5")} aria-label="Questions answered per day">
        {bars.map((b) => {
          const isToday = b.day === today;
          const future = b.questions === null;
          return (
            <li key={b.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={future ? b.day : `${b.day}: ${b.questions} questions`}>
              <span className="sr-only">{future ? `${b.day}: still to come` : `${b.day}: ${b.questions} questions`}</span>
              <span
                aria-hidden
                className={cn(
                  "w-full rounded-md",
                  future ? "h-1 bg-muted/50" : b.questions === 0 ? "h-1 bg-muted" : isToday ? "bg-gold" : "bg-primary",
                )}
                style={future || b.questions === 0 ? undefined : { height: `${Math.max(((b.questions ?? 0) / max) * 100, 8)}%` }}
              />
              {showLabels ? (
                <span aria-hidden className={cn("text-[0.65rem] font-semibold", isToday ? "text-foreground" : "text-muted-foreground", future && "opacity-60")}>
                  {b.label}
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
