"use client";

import { cn } from "@/lib/utils";

interface Choice<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

/** Single-select chips with radio semantics (arrow keys handled by native tab order + click). */
export function ChoiceChips<T extends string | number>({
  label,
  choices,
  value,
  onChange,
  columns = "auto",
}: {
  label: string;
  choices: Choice<T>[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: "auto" | "list";
}) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-2 font-display text-lg font-semibold">{label}</p>
      <div className={cn(columns === "list" ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-wrap gap-2")}>
        {choices.map((c) => {
          const selected = c.value === value;
          return (
            <button
              key={String(c.value)}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={c.disabled}
              onClick={() => onChange(c.value)}
              className={cn(
                "rounded-2xl border-2 border-b-4 bg-card text-[0.95rem] font-semibold transition active:translate-y-0.5 active:border-b-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
                columns === "list" ? "flex min-h-14 items-center gap-3 px-3 text-left" : "h-12 min-w-14 px-4",
                selected && "border-primary bg-secondary text-secondary-foreground",
              )}
            >
              {c.icon}
              <span className="flex-1">{c.label}</span>
              {c.hint ? <span className="text-xs font-normal text-muted-foreground">{c.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
