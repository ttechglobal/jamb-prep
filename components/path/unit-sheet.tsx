"use client";

import { Loader2, Play, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { PathUnit } from "@/lib/path/types";
import { cn } from "@/lib/utils";

const GOALS = [
  { stars: 1, title: "First star", text: "Get 6 of 10 right" },
  { stars: 2, title: "Second star", text: "On another day, stay at 70% or more" },
  { stars: 3, title: "Third star: Solid", text: "A week later, still at 80% or more" },
];

export type SheetTarget = { kind: "unit"; unit: PathUnit; share: number; number: number } | { kind: "check"; unitIds: string[]; names: string[] };

/** The bottom sheet that opens from a node: what the unit is, what its stars need, and a Start button. */
export function UnitSheet({
  target,
  starting,
  onStart,
  onClose,
}: {
  target: SheetTarget | null;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 gap-3 rounded-b-none rounded-t-3xl p-5 pb-6",
          "sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
        )}
      >
        {target?.kind === "unit" ? (
          <>
            <div className="flex items-center gap-3.5 pr-8">
              <span className="grid size-[4.5rem] shrink-0 place-items-center rounded-full border-b-[6px] border-[#4C1D95] bg-violet text-white">
                <Play className="ml-0.5 size-8 fill-current" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-xs font-semibold tracking-wide text-violet">TOPIC {target.number}</p>
                <DialogTitle className="font-display text-2xl leading-tight font-semibold">{target.unit.name}</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-sm leading-snug text-muted-foreground">
              {target.share >= 2 ? `Comes up in about 1 in ${target.share} questions. ` : ""}
              Ten questions, with an explanation after each one.
            </DialogDescription>

            <ul className="flex flex-col gap-2">
              {GOALS.map((g) => {
                const earned = target.unit.stars >= g.stars;
                return (
                  <li key={g.stars} className={cn("flex items-center gap-3 rounded-2xl border-2 px-3 py-2", earned ? "border-gold bg-gold-soft" : "bg-background")}>
                    <span className="flex w-14 shrink-0 gap-0.5" aria-hidden>
                      {Array.from({ length: g.stars }).map((_, i) => (
                        <Star key={i} className={cn("size-4", earned ? "fill-gold text-gold-edge" : "fill-muted text-border")} strokeWidth={1.8} />
                      ))}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">
                        {g.title}
                        {earned ? <span className="sr-only"> (earned)</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">{g.text}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {target.unit.revisit ? (
              <p className="rounded-xl bg-flame-soft px-3 py-2 text-sm text-flame">Your recent answers here have slipped. A round will bring it back.</p>
            ) : null}
            <p className="text-center text-xs text-muted-foreground">Answers on this topic anywhere in the app count toward its stars.</p>
          </>
        ) : target?.kind === "check" ? (
          <>
            <div className="flex items-center gap-3.5 pr-8">
              <span className="grid h-[4.5rem] w-[5.25rem] shrink-0 place-items-center rounded-[1.4rem] border-[3px] border-dashed border-violet bg-violet-soft text-violet">
                <Trophy className="size-8" aria-hidden />
              </span>
              <div>
                <p className="font-display text-xs font-semibold tracking-wide text-violet">CHECKPOINT</p>
                <DialogTitle className="font-display text-2xl leading-tight font-semibold">Mixed check</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-sm leading-snug text-muted-foreground">
              Ten questions drawn from the topics in this section. A good test of what has stuck.
            </DialogDescription>
            <ul className="flex flex-wrap gap-1.5">
              {target.names.map((n) => (
                <li key={n} className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                  {n}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <Button variant="gold" size="xl" className="mt-1 w-full" disabled={starting} onClick={onStart}>
          {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {target?.kind === "check" ? "Start mixed check" : "Start 10 questions"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
