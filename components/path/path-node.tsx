import { Check, Play, RotateCcw, Star, Trophy } from "lucide-react";
import type { PathUnit } from "@/lib/path/types";
import { cn } from "@/lib/utils";

/** Three small stars under a node. Filled ones are earned. */
export function StarPips({ count, className }: { count: number; className?: string }) {
  return (
    <span role="img" aria-label={`${count} of 3 stars`} className={cn("inline-flex gap-0.5", className)}>
      {[0, 1, 2].map((i) => (
        <Star key={i} aria-hidden className={cn("size-3.5", i < count ? "fill-gold text-gold-edge" : "fill-muted text-border")} strokeWidth={1.8} />
      ))}
    </span>
  );
}

type NodeState = "solid" | "progress" | "revisit" | "next" | "open";

function stateOf(unit: PathUnit, isNext: boolean): NodeState {
  if (unit.revisit) return "revisit";
  if (unit.stars >= 3) return "solid";
  if (isNext) return "next";
  if (unit.stars >= 1) return "progress";
  return "open";
}

const NODE: Record<NodeState, string> = {
  solid: "bg-gold border-gold-edge text-gold-ink",
  progress: "bg-brand-bright border-primary-edge text-white",
  revisit: "bg-[#FB923C] border-[#C2410C] text-white",
  next: "bg-violet border-[#4C1D95] text-white shadow-[0_0_0_8px_#DDD6FE] size-[5.5rem]",
  open: "bg-muted border-[#CBD5CE] text-muted-foreground",
};

/** One unit on the trail. `offset` is the sideways wiggle in pixels. */
export function PathNode({
  unit,
  number,
  isNext,
  offset,
  onOpen,
}: {
  unit: PathUnit;
  number: number;
  isNext: boolean;
  offset: number;
  onOpen: () => void;
}) {
  const state = stateOf(unit, isNext);
  const status =
    state === "revisit" ? "Revisit" : state === "next" ? "Next up" : unit.stars === 0 ? "Not started" : `${unit.stars} of 3 stars`;
  return (
    <li className="flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${unit.name}. ${status}.`}
        style={{ transform: `translateX(${offset}px)` }}
        className="group relative flex w-44 flex-col items-center focus-visible:outline-none"
      >
        {state === "next" ? (
          <span className="absolute -top-3 z-10 rounded-xl bg-gold px-3 py-0.5 font-display text-sm font-semibold text-gold-ink shadow-[0_3px_0_0_var(--gold-edge)]">
            {unit.stars === 0 && unit.answers === 0 ? "START" : "NEXT"}
          </span>
        ) : null}
        <span
          className={cn(
            "mt-3 grid size-[4.5rem] place-items-center rounded-full border-b-[6px] font-display text-2xl font-semibold transition group-active:translate-y-1 group-active:border-b-2 group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
            NODE[state],
          )}
        >
          {state === "solid" ? (
            <Star className="size-8 fill-current" aria-hidden />
          ) : state === "revisit" ? (
            <RotateCcw className="size-7" strokeWidth={3} aria-hidden />
          ) : state === "next" ? (
            <Play className="ml-0.5 size-8 fill-current" aria-hidden />
          ) : state === "progress" ? (
            <Check className="size-8" strokeWidth={3.4} aria-hidden />
          ) : (
            number
          )}
        </span>
        {unit.stars > 0 || state === "revisit" ? <StarPips count={unit.stars} className="mt-1.5" /> : null}
        <span className={cn("mt-1 text-center font-display text-sm font-semibold leading-tight", state === "open" && "text-muted-foreground")}>
          {unit.name}
        </span>
        {state === "revisit" ? <span className="text-xs font-bold text-[#C2410C]">Revisit</span> : null}
      </button>
    </li>
  );
}

/** The mixed check at the end of a section. */
export function CheckNode({ offset, done, onOpen }: { offset: number; done: boolean; onOpen: () => void }) {
  return (
    <li className="flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        style={{ transform: `translateX(${offset}px)` }}
        aria-label={`Mixed check. ${done ? "Done" : "Open"}.`}
        className="group flex w-44 flex-col items-center focus-visible:outline-none"
      >
        <span
          className={cn(
            "grid h-[4.5rem] w-[5.25rem] place-items-center rounded-[1.4rem] border-[3px] border-dashed transition group-active:translate-y-1 group-focus-visible:ring-3 group-focus-visible:ring-ring/60",
            done ? "border-violet bg-violet text-white" : "border-violet bg-violet-soft text-violet",
          )}
        >
          <Trophy className="size-8" aria-hidden />
        </span>
        <span className="mt-1.5 font-display text-sm font-semibold text-[#4C1D95]">Mixed check</span>
        <span className="text-xs text-muted-foreground">{done ? "Done. Take it again any time" : "10 questions from this section"}</span>
      </button>
    </li>
  );
}
