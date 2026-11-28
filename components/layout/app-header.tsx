"use client";

import Link from "next/link";
import { Timer } from "lucide-react";
import { usePathname } from "next/navigation";
import { isFocusedPage } from "@/lib/games/session-route";
import { Logo } from "@/components/brand/logo";
import { StreakPill, XpPill } from "@/components/game/game-ui";
import { useAppState } from "@/lib/app-state";
import { liveStreak } from "@/lib/game/rules";
import { PATH_ENABLED } from "@/lib/path/flag";
import { cn } from "@/lib/utils";

/** Desktop navigation. Phones use the bottom bar instead. */
const NAV = [
  { href: "/practice", label: "Practice" },
  ...(PATH_ENABLED ? [{ href: "/path", label: "Study path" }] : []),
  { href: "/read", label: "Read" },
  { href: "/study", label: "Study" },
  { href: "/games", label: "Games" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function AppHeader() {
  const pathname = usePathname();
  const { profile, progress } = useAppState();
  const initial = (profile?.displayName || "?").charAt(0).toUpperCase();
  if (isFocusedPage(pathname)) return null;

  return (
    <header className="sticky top-0 z-30 border-b-2 bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-15 max-w-5xl items-center gap-5 px-4">
        <Logo href="/practice" compact />
        <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className={cn(
                "rounded-xl px-3 py-2 font-display font-semibold text-muted-foreground transition-colors hover:text-foreground",
                "aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/study"
            aria-label="Study timer"
            className="grid size-10 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground sm:hidden"
          >
            <Timer className="size-5" aria-hidden />
          </Link>
          <StreakPill days={liveStreak(progress)} />
          <XpPill xp={progress.xp} />
          <Link
            href="/settings"
            aria-label="Your profile and progress"
            className="ml-1 grid size-10 place-items-center rounded-full border-2 border-b-4 border-primary bg-secondary font-display font-semibold text-secondary-foreground transition hover:brightness-95"
          >
            {initial}
          </Link>
        </div>
      </div>
    </header>
  );
}
