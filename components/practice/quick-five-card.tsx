"use client";

import { Loader2, Zap } from "lucide-react";
import { useState } from "react";
import { SubjectIcon } from "@/components/game/game-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useStartSession } from "@/hooks/use-start-session";
import { SUBJECTS } from "@/lib/catalog";
import { quickFive } from "@/lib/engine/presets";
import { cn } from "@/lib/utils";

/** Quick Five on a phone: a small card like the other modes. Tapping it asks which subject, then starts. */
export function QuickFiveCard({ subjectIds, className }: { subjectIds: string[]; className?: string }) {
  const { start, starting } = useStartSession();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "game-card game-tap group flex min-h-30 flex-col border-primary/40 bg-secondary/50 p-4 text-left",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        <span className="grid size-10 place-items-center rounded-xl bg-gold text-gold-ink">
          <Zap className="size-5 fill-gold text-gold-edge" strokeWidth={2.4} />
        </span>
        <p className="mt-auto pt-3 font-display text-[1.05rem] font-semibold leading-tight">Quick Five</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Five questions, fast</p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            "top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 gap-3 rounded-b-none rounded-t-3xl p-5 pb-6",
            "sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
          )}
        >
          <div className="flex items-center gap-3 pr-8">
            <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-gold-ink">
              <Zap className="size-6 fill-gold text-gold-edge" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <DialogTitle className="font-display text-2xl leading-tight font-semibold">Quick Five</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">Five questions. Pick a subject to start.</DialogDescription>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2.5">
            {subjectIds.map((id) => {
              const subject = SUBJECTS.find((s) => s.id === id);
              const busy = starting && chosen === id;
              return (
                <li key={id}>
                  <Button
                    variant="outline"
                    size="xl"
                    aria-label={`Quick Five in ${subject?.name}`}
                    disabled={starting}
                    onClick={() => {
                      setChosen(id);
                      start(quickFive([id]));
                    }}
                    className="h-14 w-full justify-start gap-2 px-2.5"
                  >
                    <SubjectIcon id={id} className="size-8 rounded-lg" iconClassName="size-4" />
                    <span className="min-w-0 flex-1 truncate text-left text-[0.95rem]">{subject?.shortName}</span>
                    {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  </Button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
