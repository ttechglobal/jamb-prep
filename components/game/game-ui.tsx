import { Flame, Star, Zap } from "lucide-react";
import { levelFor } from "@/lib/game/rules";
import { subjectStyle } from "@/lib/game/subject-style";
import { cn } from "@/lib/utils";

export function SubjectIcon({ id, className, iconClassName }: { id: string; className?: string; iconClassName?: string }) {
  const { icon: Icon, color, soft } = subjectStyle(id);
  return (
    <span aria-hidden className={cn("grid size-10 shrink-0 place-items-center rounded-xl", className)} style={{ background: soft, color }}>
      <Icon className={cn("size-5", iconClassName)} strokeWidth={2.4} />
    </span>
  );
}

export function StreakPill({ days, className }: { days: number; className?: string }) {
  return (
    <span
      aria-label={`${days} day streak`}
      className={cn("inline-flex h-9 items-center gap-1 rounded-full bg-flame-soft px-2.5 font-display text-sm font-semibold text-foreground", className)}
    >
      <Flame className={cn("size-4", days > 0 ? "fill-flame text-flame" : "text-muted-foreground")} aria-hidden />
      {days}
    </span>
  );
}

export function XpPill({ xp, className }: { xp: number; className?: string }) {
  return (
    <span
      aria-label={`${xp} XP`}
      className={cn("inline-flex h-9 items-center gap-1 rounded-full bg-gold-soft px-2.5 font-display text-sm font-semibold text-gold-ink", className)}
    >
      <Zap className="size-4 fill-gold text-gold-edge" aria-hidden />
      {xp.toLocaleString()}
    </span>
  );
}

/** Hexagon level badge. Inline SVG, so it costs no extra requests. */
export function LevelBadge({ level, className }: { level: number; className?: string }) {
  return (
    <span className={cn("relative inline-grid size-12 shrink-0 place-items-center", className)}>
      <svg viewBox="0 0 48 52" className="absolute inset-0 size-full" aria-hidden>
        <path d="M24 4 L44 15 V37 L24 48 L4 37 V15 Z" transform="translate(0 3)" fill="var(--gold-edge)" stroke="var(--gold-edge)" strokeWidth="5" strokeLinejoin="round" />
        <path d="M24 3 L44 14 V36 L24 47 L4 36 V14 Z" fill="var(--gold)" stroke="var(--gold)" strokeWidth="5" strokeLinejoin="round" />
      </svg>
      <span className="relative -mt-0.5 font-display text-lg font-bold text-gold-ink">
        <span className="sr-only">Level </span>
        {level}
      </span>
    </span>
  );
}

export function Meter({
  percent,
  label,
  className,
  barClassName,
  color,
}: {
  percent: number;
  label: string;
  className?: string;
  barClassName?: string;
  color?: string;
}) {
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={cn("h-3 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("relative h-full min-w-3 rounded-full bg-gold transition-[width] duration-500 ease-out", value === 0 && "hidden", barClassName)}
        style={{ width: `${value}%`, background: color }}
      >
        <span aria-hidden className="absolute inset-x-1.5 top-[3px] h-[3px] rounded-full bg-white/40" />
      </div>
    </div>
  );
}

export function LevelBar({ xp, className }: { xp: number; className?: string }) {
  const lvl = levelFor(xp);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <LevelBadge level={lvl.level} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-display text-base font-semibold leading-tight">{lvl.title}</p>
          <p className="shrink-0 text-xs font-medium text-muted-foreground">
            {lvl.toNext} XP to level {lvl.level + 1}
          </p>
        </div>
        <Meter percent={lvl.percent} label={`Progress to level ${lvl.level + 1}`} className="mt-1.5" />
      </div>
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 72,
  stroke = 8,
  trackColor = "var(--muted)",
  color = "var(--primary)",
  children,
  label,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  trackColor?: string;
  color?: string;
  children?: React.ReactNode;
  label: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const value = Math.max(0, Math.min(100, percent));
  return (
    <div role="img" aria-label={label} className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

export function Stars({ count, className }: { count: number; className?: string }) {
  return (
    <div role="img" aria-label={`${count} of 3 stars`} className={cn("flex items-end justify-center gap-1", className)}>
      {[0, 1, 2].map((i) => (
        <Star
          key={i}
          aria-hidden
          style={{ animationDelay: `${200 + i * 170}ms` }}
          className={cn(
            "animate-pop",
            i === 1 ? "size-16 -translate-y-2" : "size-12",
            i < count ? "fill-gold text-gold-edge" : "fill-muted text-border",
          )}
          strokeWidth={1.6}
        />
      ))}
    </div>
  );
}

const CONFETTI = ["var(--gold)", "var(--brand-bright)", "var(--flame)", "#38BDF8", "#A78BFA"];

/** CSS-only burst. Hidden entirely under prefers-reduced-motion. */
export function Confetti() {
  return (
    <div data-confetti aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-10 h-0 overflow-visible">
      {Array.from({ length: 18 }, (_, i) => (
        <span
          key={i}
          className="absolute top-0 h-3 w-2 rounded-[2px]"
          style={{
            left: `${(i * 37 + 7) % 100}%`,
            background: CONFETTI[i % CONFETTI.length],
            animation: `confetti-fall ${1.6 + (i % 5) * 0.25}s ease-in ${(i % 6) * 0.08}s both`,
          }}
        />
      ))}
    </div>
  );
}
