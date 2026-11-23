import {
  Binary,
  Blocks,
  ChartSpline,
  CircleHelp,
  EyeOff,
  Footprints,
  ListChecks,
  ListOrdered,
  Logs,
  Merge,
  PenLine,
  Percent,
  Ruler,
  Scale,
  SearchCheck,
  Superscript,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type IconProps = React.ComponentProps<LucideIcon>;

/** A fraction: one box over another, with the bar between. Drawn to match the other icons. */
const Fraction = (({ className, strokeWidth = 2, ...rest }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden
    {...rest}
  >
    <rect x="8" y="2.5" width="8" height="6.5" rx="1.5" />
    <path d="M4 12h16" />
    <rect x="8" y="15" width="8" height="6.5" rx="1.5" />
  </svg>
)) as LucideIcon;

/** One picture for each topic, so a student can find theirs without reading. */
const TOPIC: Record<string, { Icon: LucideIcon; tint: string }> = {
  fractions: { Icon: Fraction, tint: "bg-flame-soft text-flame" },
  percent: { Icon: Percent, tint: "bg-gold-soft text-gold-ink" },
  linear: { Icon: Scale, tint: "bg-sky-soft text-sky" },
  mensuration: { Icon: Ruler, tint: "bg-secondary text-primary" },
  bases: { Icon: Binary, tint: "bg-violet-soft text-violet" },
  variation: { Icon: TrendingUp, tint: "bg-sky-soft text-sky" },
  indices: { Icon: Superscript, tint: "bg-flame-soft text-flame" },
  simultaneous: { Icon: Merge, tint: "bg-violet-soft text-violet" },
  logs: { Icon: Logs, tint: "bg-gold-soft text-gold-ink" },
  quadratics: { Icon: ChartSpline, tint: "bg-secondary text-primary" },
};

/** One picture for each kind of game in a topic's ladder. */
const LEVEL: Record<string, LucideIcon> = {
  "pick-one": ListChecks,
  order: ListOrdered,
  why: CircleHelp,
  "pick-two": Footprints,
  build: Blocks,
  spot: SearchCheck,
  "no-hints": EyeOff,
  solve: PenLine,
};

export function TopicIcon({ topicId, className, iconClassName }: { topicId: string; className?: string; iconClassName?: string }) {
  const { Icon, tint } = TOPIC[topicId] ?? TOPIC.linear;
  return (
    <span aria-hidden className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", tint, className)}>
      <Icon className={cn("size-6", iconClassName)} strokeWidth={2.2} />
    </span>
  );
}

export function LevelIcon({ levelId, className }: { levelId: string; className?: string }) {
  const Icon = LEVEL[levelId] ?? ListChecks;
  return <Icon className={cn("size-6", className)} strokeWidth={2.2} aria-hidden />;
}
