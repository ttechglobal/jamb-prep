import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Tone = "dark" | "light";

export function LogoMark() {
  return <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 shrink-0" />;
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
      <LogoMark />
      <span className={cn("font-display text-[1.15rem] font-semibold", tone === "light" ? "text-white" : "text-foreground", compact && "hidden min-[400px]:inline")}>
        JAMB <span className={tone === "light" ? "text-gold" : "text-primary"}>Prep</span>
      </span>
    </Link>
  );
}
