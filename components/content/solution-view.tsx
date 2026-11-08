import { ChevronDown, CircleX, Lightbulb, Sigma, Target } from "lucide-react";
import { Blocks } from "@/components/content/blocks";
import type { OptionKey, Solution } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const KEYS: OptionKey[] = ["A", "B", "C", "D"];

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 inline-flex items-center gap-1.5 text-sm font-semibold">{children}</p>;
}

/** The explanation. Shown only once the mode has released it, so it needs no mode logic. */
export function SolutionView({
  solution,
  selected = null,
  omit,
}: {
  solution: Solution;
  selected?: OptionKey | null;
  /** A part already shown above, so it isn't repeated. */
  omit?: "intro" | "answer";
}) {
  const wrong = KEYS.filter((k) => solution.wrongOptions?.[k]?.length);

  return (
    <div className="mt-3 space-y-3.5 text-[0.95rem] leading-relaxed">
      {solution.intro?.length && omit !== "intro" ? <Blocks blocks={solution.intro} /> : null}

      {solution.formula?.length ? (
        <div className="rounded-xl bg-background/70 p-3">
          <Label>
            <Sigma className="size-4" aria-hidden /> Formula
          </Label>
          <Blocks blocks={solution.formula} />
          {solution.variables?.length ? <Blocks blocks={solution.variables} className="mt-2 text-sm text-muted-foreground" /> : null}
        </div>
      ) : null}

      {solution.steps?.length ? (
        <ol className="m-0 list-none space-y-2.5 p-0">
          {solution.steps.map((step, i) => (
            <li key={i} className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span aria-hidden className="grid size-7 place-items-center rounded-full bg-background/80 font-display text-sm font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{step.title}</p>
                <Blocks blocks={step.blocks} className="mt-0.5" />
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {solution.figures?.length ? <Blocks blocks={solution.figures} /> : null}

      {omit !== "answer" ? (
        <div className="rounded-xl border-2 border-success bg-background/70 p-3">
          <Label>
            <Target className="size-4 text-primary-edge" aria-hidden /> Answer
          </Label>
          <Blocks blocks={solution.answer} />
        </div>
      ) : null}

      {wrong.length ? (
        <details className="group">
          {/* Folded until tapped, so the explanation stays short. */}
          <summary className="mb-1.5 flex min-h-11 w-full cursor-pointer list-none items-center gap-1.5 rounded-xl bg-background/70 px-3 py-2 text-sm font-semibold [&::-webkit-details-marker]:hidden">
            <CircleX className="size-4 text-destructive" aria-hidden />
            <span className="flex-1">Why the others are wrong</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="m-0 list-none divide-y-2 overflow-hidden rounded-xl border-2 bg-card p-0">
            {wrong.map((key) => {
              const mine = key === selected;
              return (
                <li key={key} className="flex gap-2.5 p-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg font-display text-sm font-semibold",
                      mine ? "bg-destructive text-white" : "bg-danger-soft text-destructive-edge",
                    )}
                  >
                    {key}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5 text-sm">
                    <span className="sr-only">Option {key}. </span>
                    {mine ? <p className="mb-0.5 text-xs font-semibold text-destructive">Your answer</p> : null}
                    <Blocks blocks={solution.wrongOptions![key]!} />
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {solution.studyTip?.length ? (
        <div className="flex gap-2.5 rounded-xl border-2 border-b-4 border-gold bg-gold-soft p-3 text-gold-ink">
          <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-gold">
            <Lightbulb className="size-4.5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-display font-semibold">Study tip</p>
            <Blocks blocks={solution.studyTip} className="mt-0.5" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
