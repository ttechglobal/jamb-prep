"use client";

import { Check, Lock } from "lucide-react";
import { SubjectIcon } from "@/components/game/game-ui";
import { SUBJECTS } from "@/lib/catalog";
import { UTME_FORMAT } from "@/lib/exam-format";
import { cn } from "@/lib/utils";

const OTHERS_NEEDED = UTME_FORMAT.subjectCount - 1;

/** Use of English is locked in; the student picks exactly three more. */
export function SubjectPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const others = value.filter((id) => id !== UTME_FORMAT.compulsorySubjectSlug);

  function toggle(id: string) {
    const next = others.includes(id)
      ? others.filter((s) => s !== id)
      : others.length < OTHERS_NEEDED
        ? [...others, id]
        : others;
    onChange([UTME_FORMAT.compulsorySubjectSlug, ...next]);
  }

  return (
    <fieldset>
      <legend className="sr-only">UTME subjects</legend>
      <p className="mb-3 text-sm font-medium text-muted-foreground" aria-live="polite">
        {others.length} of {OTHERS_NEEDED} chosen
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUBJECTS.map((s) => {
          const locked = s.isCompulsory;
          const selected = locked || others.includes(s.id);
          const disabled = !locked && !selected && others.length >= OTHERS_NEEDED;
          return (
            <li key={s.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-disabled={locked || disabled}
                disabled={disabled}
                onClick={() => !locked && toggle(s.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-b-4 bg-card px-3 text-left text-[0.95rem] font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected && "border-primary bg-secondary text-secondary-foreground",
                  disabled && "opacity-45",
                  locked && "cursor-default",
                )}
              >
                <SubjectIcon id={s.id} />
                <span className="flex-1">{s.name}</span>
                {locked ? (
                  <Lock className="size-4 text-muted-foreground" aria-label="Compulsory" />
                ) : (
                  <span
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-lg border-2",
                      selected && "animate-pop border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden
                  >
                    {selected ? <Check className="size-4" strokeWidth={3} /> : null}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

export function isValidSubjectSelection(ids: string[]) {
  return (
    ids.includes(UTME_FORMAT.compulsorySubjectSlug) &&
    ids.length === UTME_FORMAT.subjectCount &&
    new Set(ids).size === UTME_FORMAT.subjectCount &&
    ids.every((id) => SUBJECTS.some((s) => s.id === id))
  );
}
