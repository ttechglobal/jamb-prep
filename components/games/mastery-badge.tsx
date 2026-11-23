import { Star } from "lucide-react";
import type { Mastery } from "@/lib/games/maths/engine";
import { cn } from "@/lib/utils";

const TONE: Record<Mastery["rank"], string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-flame-soft text-flame",
  2: "bg-gold-soft text-gold-ink",
  3: "bg-sky-soft text-sky",
  4: "bg-success-soft text-primary-edge",
};

/** How well a student knows a topic, from the stars they have earned on its levels. */
export function MasteryBadge({ mastery, className }: { mastery: Mastery; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TONE[mastery.rank], className)}>
      <Star className="size-3.5 fill-current" aria-hidden />
      {mastery.label}
      <span className="opacity-70">
        {mastery.stars}/{mastery.max}
      </span>
    </span>
  );
}
