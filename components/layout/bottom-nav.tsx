"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isGameSession } from "@/lib/games/session-route";
import { cn } from "@/lib/utils";

const INK = "#1F2937";
const stroke = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: "round", strokeLinecap: "round" } as const;

/** Flat 2D illustrations: a bold outline and a few solid colours, so each tab is recognisable at a glance. */
function PracticeArt() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <rect x="8" y="6" width="27" height="36" rx="4.5" fill="#22C55E" {...stroke} />
      <rect x="8" y="6" width="7" height="36" rx="3" fill="#15803D" {...stroke} />
      <path d="M21 16h9M21 22h9M21 28h6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
      <g transform="rotate(32 36 28)">
        <rect x="32.5" y="12" width="7" height="25" rx="1.5" fill="#FACC15" {...stroke} />
        <path d="M32.5 37h7l-3.5 7z" fill="#FDE7C0" {...stroke} />
        <rect x="32.5" y="12" width="7" height="5" rx="1.5" fill="#F87171" {...stroke} />
      </g>
    </svg>
  );
}

function GamesArt() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path
        d="M14 15h20c5 0 8 3.5 9 9l1.5 8c.7 4-1.6 7-5 7-2.6 0-4-1.5-5.5-3.6L31 32H17l-3 3.4C12.5 37.5 11.100 39 8.500 39c-3.400 0-5.700-3-5-7l1.500-8c1-5.500 4-9 9-9z"
        fill="#8B5CF6"
        {...stroke}
      />
      <path d="M15 21v8M11 25h8" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="32" cy="22.500" r="2.600" fill="#FACC15" {...stroke} strokeWidth={1.8} />
      <circle cx="37" cy="27.500" r="2.600" fill="#F87171" {...stroke} strokeWidth={1.8} />
    </svg>
  );
}

function RanksArt() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <path d="M14 11H7c0 8 3 12 8 13M34 11h7c0 8-3 12-8 13" fill="none" {...stroke} />
      <path d="M13 6h22v13c0 6-5 10.500-11 10.500S13 25 13 19z" fill="#FACC15" {...stroke} />
      <path d="M24 10.500l2.200 4.600 5 .6-3.700 3.400 1 5-4.500-2.500-4.500 2.500 1-5-3.700-3.400 5-.6z" fill="#fff" stroke={INK} strokeWidth="1.600" strokeLinejoin="round" />
      <path d="M24 29.500V36" {...stroke} />
      <rect x="15" y="36" width="18" height="7" rx="2.500" fill="#F59E0B" {...stroke} />
    </svg>
  );
}

function ProgressArt() {
  return (
    <svg viewBox="0 0 48 48" className="size-full" aria-hidden>
      <rect x="5" y="27" width="10" height="15" rx="2.500" fill="#38BDF8" {...stroke} />
      <rect x="19" y="18" width="10" height="24" rx="2.500" fill="#22C55E" {...stroke} />
      <rect x="33" y="8" width="10" height="34" rx="2.500" fill="#FACC15" {...stroke} />
      <path d="M8 20l9-7 8 3 10-9" fill="none" stroke="#F87171" strokeWidth="2.600" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TABS = [
  { href: "/practice", label: "Practice", Art: PracticeArt },
  { href: "/games", label: "Games", Art: GamesArt },
  { href: "/leaderboard", label: "Ranks", Art: RanksArt },
  { href: "/progress", label: "Progress", Art: ProgressArt },
];

/** While someone is playing a game level the bar steps aside, like it does in a practice round. */

export function BottomNav() {
  const pathname = usePathname();
  if (isGameSession(pathname)) return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-4 gap-1 px-2 pt-1.5 pb-1.5">
        {TABS.map(({ href, label, Art }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-2xl px-1 pb-1 pt-1.5 font-display text-[0.7rem] font-semibold leading-none transition-colors",
                  "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "block size-9 transition-transform duration-150",
                    active ? "-translate-y-0.5 scale-110" : "opacity-75 saturate-50",
                  )}
                >
                  <Art />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
