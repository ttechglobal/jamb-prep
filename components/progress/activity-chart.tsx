"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Day = { day: string; questions: number; rounds: number };

const LETTER = ["S", "M", "T", "W", "T", "F", "S"];

/** Questions answered each day for the last two weeks. Shows consistency, not scores. */
export function ActivityChart() {
  const [days, setDays] = useState<Day[] | null>(null);

  useEffect(() => {
    let live = true;
    supabase()
      .rpc("get_activity", { p_days: 14 })
      .then(({ data, error }) => {
        if (live && !error && Array.isArray(data)) setDays(data as Day[]);
      });
    return () => {
      live = false;
    };
  }, []);

  if (!days) return null;

  const max = Math.max(...days.map((d) => d.questions), 1);
  const total = days.reduce((s, d) => s + d.questions, 0);
  const active = days.filter((d) => d.questions > 0).length;

  return (
    <section aria-labelledby="activity-title" className="game-card p-4">
      <h2 id="activity-title" className="font-display text-lg font-semibold">
        Last 14 days
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {total === 0
          ? "No practice yet in the last two weeks."
          : `${total} ${total === 1 ? "question" : "questions"} on ${active} of 14 days.`}
      </p>
      <ol className="mt-4 flex h-32 items-end gap-1.5" aria-label="Questions answered per day">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          const letter = LETTER[new Date(`${d.day}T00:00:00`).getDay()];
          return (
            <li key={d.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.questions} questions`}>
              <span className="sr-only">
                {d.day}: {d.questions} questions
              </span>
              <span
                aria-hidden
                className={cn(
                  "w-full rounded-md",
                  d.questions === 0 ? "h-1 bg-muted" : isToday ? "bg-gold" : "bg-primary",
                )}
                style={d.questions === 0 ? undefined : { height: `${Math.max((d.questions / max) * 100, 8)}%` }}
              />
              <span aria-hidden className={cn("text-[0.65rem] font-semibold", isToday ? "text-foreground" : "text-muted-foreground")}>
                {letter}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
