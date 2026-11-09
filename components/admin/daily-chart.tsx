"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface DayPoint {
  day: string;
  rounds: number;
  active: number;
  joined: number;
}

const fmt = new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const short = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });

/** Rounds practised each day. Tap or hover a bar to read that day's numbers above the chart. */
export function DailyChart({ data }: { data: DayPoint[] }) {
  const [picked, setPicked] = useState<number | null>(null);
  const peak = Math.max(1, ...data.map((d) => d.rounds));
  const index = picked ?? data.length - 1;
  const current = data[index];
  const every = Math.ceil(data.length / 7); // about seven date labels, however long the period

  return (
    <div>
      <p className="min-h-6 text-sm" aria-live="polite">
        <strong>{fmt.format(new Date(current.day))}</strong>
        <span className="text-muted-foreground">
          {" · "}
          {current.rounds} {current.rounds === 1 ? "round" : "rounds"} · {current.active} {current.active === 1 ? "student" : "students"} practised · {current.joined} new{" "}
          {current.joined === 1 ? "member" : "members"}
        </span>
      </p>
      <div className="mt-2 flex h-40 items-end gap-[3px]" role="group" aria-label="Rounds practised each day">
        {data.map((d, i) => (
          <button
            key={d.day}
            type="button"
            aria-label={`${fmt.format(new Date(d.day))}: ${d.rounds} rounds`}
            onMouseEnter={() => setPicked(i)}
            onFocus={() => setPicked(i)}
            onClick={() => setPicked(i)}
            onMouseLeave={() => setPicked(null)}
            className="group flex h-full min-w-0 flex-1 items-end focus-visible:outline-none"
          >
            <span
              className={cn(
                "w-full rounded-t-[4px] transition-colors",
                d.rounds === 0 ? "bg-muted" : i === index ? "bg-primary" : "bg-brand-bright/70",
                "group-focus-visible:ring-2 group-focus-visible:ring-ring",
              )}
              style={{ height: `${Math.max(3, (d.rounds / peak) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[0.7rem] text-muted-foreground" aria-hidden>
        {data.map((d, i) => (
          <span key={d.day} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
            {i % every === 0 ? short.format(new Date(d.day)) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
