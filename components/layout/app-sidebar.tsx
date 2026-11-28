"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { LevelBar } from "@/components/game/game-ui";
import { StudyArt, TABS } from "@/components/layout/bottom-nav";
import { useAppState } from "@/lib/app-state";
import { isFocusedPage } from "@/lib/games/session-route";
import { clock, useStudyTimer } from "@/lib/study/session";
import { cn } from "@/lib/utils";

/** The sidebar order: the study timer sits with the other ways to learn. */
const ITEMS = [
  ...TABS.filter((t) => t.href !== "/games" && t.href !== "/leaderboard"),
  { href: "/study", label: "Study", Art: StudyArt },
  ...TABS.filter((t) => t.href === "/games" || t.href === "/leaderboard").map((t) => (t.href === "/leaderboard" ? { ...t, label: "Leaderboard" } : t)),
];

/** Desktop navigation: a left sidebar with the student's level at the bottom. Phones and tablets keep the top and bottom bars. */
export function AppSidebar() {
  const pathname = usePathname();
  const { progress } = useAppState();
  const timer = useStudyTimer();
  if (isFocusedPage(pathname)) return null;

  return (
    <aside aria-label="Sidebar" className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r-2 bg-background lg:flex">
      <div className="px-5 pt-5 pb-4">
        <Logo href="/practice" />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, Art }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-2xl px-3 font-display text-base font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <span className={cn("block size-8 shrink-0", !active && "opacity-80 saturate-75")}>
                    <Art />
                  </span>
                  <span className="min-w-0 flex-1">{label}</span>
                  {href === "/study" && timer.ready && timer.phase !== "idle" ? (
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground">
                      {timer.finished ? "Done" : clock(timer.left)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="flex flex-col gap-3 border-t-2 p-4">
        <Link href="/levels" aria-label="Your level and ranks" className="-m-1.5 rounded-xl p-1.5 transition hover:bg-muted">
          <LevelBar xp={progress.xp} />
        </Link>
        <Link
          href="/settings"
          className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings className="size-4" aria-hidden /> Profile and settings
        </Link>
      </div>
    </aside>
  );
}
