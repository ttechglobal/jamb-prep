import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "dark" | "light";

const COLORS: Record<Tone, { board: string; crown: string; gold: string; goldText: string }> = {
  dark: { board: "#15803D", crown: "#14532D", gold: "#FBBF24", goldText: "#713F12" },
  // On the green landing background the board turns white, so the mark never disappears.
  light: { board: "#FFFFFF", crown: "#BBF7D0", gold: "#FBBF24", goldText: "#713F12" },
};

/**
 * The logo itself: the graduation cap with the gold JAMB band under it. `labelled={false}` leaves
 * the band off, for places too small to read it.
 */
export function LogoMark({ className, tone = "dark", labelled = true }: { className?: string; tone?: Tone; labelled?: boolean }) {
  const c = COLORS[tone];
  return (
    <svg aria-hidden viewBox={labelled ? "0 0 110 108" : "0 0 110 84"} className={cn("h-11 w-auto shrink-0", className)}>
      <path d="M26 46 v22 q29 18 58 0 v-22 L55 58 z" fill={c.crown} />
      <polygon points="55,6 106,32 55,58 4,32" fill={c.board} />
      <path d="M106 32 V66" stroke={c.gold} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="106" cy="72" r="6.5" fill={c.gold} />
      {labelled ? (
        <>
          <rect x="18" y="78" width="74" height="26" rx="8" fill={c.gold} />
          <text x="55" y="97" textAnchor="middle" fontFamily="var(--font-display), 'Trebuchet MS', Arial, sans-serif" fontSize="18" fontWeight="700" fill={c.goldText}>
            JAMB
          </text>
        </>
      ) : null}
    </svg>
  );
}

export function Logo({
  href = "/",
  className,
  tone = "dark",
  compact,
}: {
  href?: string;
  className?: string;
  tone?: Tone;
  /** Hides the wordmark on narrow phones, where the header also carries XP and streak. */
  compact?: boolean;
}) {
  return (
    <Link href={href} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg", className)} aria-label="JAMB Prep home">
      <LogoMark tone={tone} />
      <span className={cn("font-display text-[1.15rem] font-semibold", tone === "light" ? "text-white" : "text-foreground", compact && "hidden min-[400px]:inline")}>
        JAMB <span className={tone === "light" ? "text-gold" : "text-primary"}>Prep</span>
      </span>
    </Link>
  );
}
