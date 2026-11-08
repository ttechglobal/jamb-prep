"use client";

import { SubjectIcon } from "@/components/game/game-ui";
import { SUBJECT_TARGET, UTME_FORMAT } from "@/lib/exam-format";
import { SUBJECTS } from "@/lib/catalog";
import { targetsFor } from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Quick picks for the total. Each one splits evenly across the subjects, in steps the sliders allow. */
const QUICK_TOTALS = [250, 300, 350, 400];

function spreadTotal(total: number, ids: string[]) {
  const steps = Math.round(total / SUBJECT_TARGET.step);
  const base = Math.floor(steps / ids.length);
  const extra = steps - base * ids.length;
  return Object.fromEntries(ids.map((id, i) => [id, Math.min(SUBJECT_TARGET.max, (base + (i < extra ? 1 : 0)) * SUBJECT_TARGET.step)]));
}

/** One target per subject, each out of 100. They add up to the student's total out of 400. */
export function SubjectTargets({
  subjectIds,
  value,
  onChange,
}: {
  subjectIds: string[];
  value: Record<string, number>;
  onChange: (targets: Record<string, number>) => void;
}) {
  const targets = targetsFor(subjectIds, value);
  const total = subjectIds.reduce((sum, id) => sum + targets[id], 0);

  return (
    <div>
      <p className="text-center font-display text-5xl font-semibold text-primary" aria-live="polite">
        {total}
        <span className="text-lg font-medium text-muted-foreground"> / {UTME_FORMAT.maxTotal}</span>
      </p>

      <div role="group" aria-label="Quick picks" className="mt-3 grid grid-cols-4 gap-2">
        {QUICK_TOTALS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={total === t}
            onClick={() => onChange(spreadTotal(t, subjectIds))}
            className={cn(
              "h-11 rounded-xl border-2 border-b-4 bg-card font-display font-semibold tabular-nums transition active:translate-y-0.5 active:border-b-2",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              total === t && "border-primary bg-secondary text-secondary-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-2.5">
        {subjectIds.map((id) => {
          const subject = SUBJECTS.find((s) => s.id === id);
          return (
            <li key={id} className="game-card flex items-center gap-3 p-3">
              <SubjectIcon id={id} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <label htmlFor={`target-${id}`} className="min-w-0 text-sm font-semibold leading-tight">
                    {subject?.name}
                  </label>
                  <span className="shrink-0 font-display text-lg font-semibold leading-none">{targets[id]}</span>
                </div>
                <input
                  id={`target-${id}`}
                  type="range"
                  min={SUBJECT_TARGET.min}
                  max={SUBJECT_TARGET.max}
                  step={SUBJECT_TARGET.step}
                  value={targets[id]}
                  onChange={(e) => onChange({ ...targets, [id]: Number(e.target.value) })}
                  className="mt-2 h-3 w-full cursor-pointer accent-[var(--primary)]"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
