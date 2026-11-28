import { clock } from "@/lib/study/session";
import { cn } from "@/lib/utils";

/** The countdown: a ring that empties as the block runs, with the time in the middle. */
export function TimerRing({
  left,
  total,
  tone,
  label,
  className,
}: {
  left: number;
  total: number;
  tone: "focus" | "break" | "done";
  label: string;
  className?: string;
}) {
  const r = 108;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, Math.max(0, left / total)) : 1;
  const color =
    tone === "break"
      ? "var(--sky)"
      : tone === "done"
        ? "var(--gold)"
        : "var(--primary)";

  return (
    <div
      className={cn(
        "relative mx-auto aspect-square w-full max-w-72",
        className,
      )}
    >
      <svg viewBox="0 0 240 240" className="size-full -rotate-90" aria-hidden>
        <circle
          cx="120"
          cy="120"
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="16"
        />
        {frac > 0 ? (
          <circle
            cx="120"
            cy="120"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
            className="transition-[stroke-dashoffset] duration-500 ease-linear"
          />
        ) : null}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <p className="font-display text-xs font-semibold tracking-widest text-muted-foreground">
          {label.toUpperCase()}
        </p>
        <p
          role="timer"
          aria-label={`${Math.floor(left / 60)} minutes ${left % 60} seconds left`}
          className="font-display text-6xl leading-none font-semibold tabular-nums"
        >
          {clock(left)}
        </p>
      </div>
    </div>
  );
}
