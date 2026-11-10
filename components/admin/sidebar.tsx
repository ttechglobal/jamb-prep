"use client";

import { Bell, ChartNoAxesColumn, LayoutDashboard, LibraryBig, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const GROUPS = [
  {
    label: null,
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Question bank",
    items: [
      { href: "/admin/questions", label: "Coverage", icon: LibraryBig },
      { href: "/admin/questions/topics", label: "Topic frequency", icon: ChartNoAxesColumn },
    ],
  },
  {
    label: "Students",
    items: [{ href: "/admin/notifications", label: "Notifications", icon: Bell }],
  },
  {
    label: "Admin",
    items: [{ href: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

/** Exact match, so Coverage is not lit up while Topic frequency is open. */
const isActive = (pathname: string, href: string) => pathname === href || pathname === `${href}/`;

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="space-y-5">
      {GROUPS.map((g, i) => (
        <div key={g.label ?? i}>
          {g.label ? <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p> : null}
          <ul className="space-y-0.5">
            {g.items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={isActive(pathname, href) ? "page" : undefined}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 font-display font-semibold text-muted-foreground hover:bg-muted hover:text-foreground aria-[current=page]:bg-primary/10 aria-[current=page]:text-primary"
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/** A fixed sidebar from large screens up, and a top bar with a slide-in menu below that. */
export function AdminSidebar({ signOut }: { signOut: React.ReactNode }) {
  const pathname = usePathname();
  // The menu is open only on the page it was opened from, so moving to another page closes it.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (value: boolean) => setOpenAt(value ? pathname : null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b-2 bg-background px-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="admin-menu"
          className="inline-flex size-11 items-center justify-center rounded-xl text-foreground hover:bg-muted"
        >
          <Menu className="size-6" aria-hidden />
        </button>
        <span className="font-display text-lg font-semibold">JAMB Prep admin</span>
      </header>

      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-2 bg-background lg:flex">
        <p className="px-6 pb-3 pt-5 font-display text-lg font-semibold">JAMB Prep admin</p>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t-2 p-3">{signOut}</div>
      </aside>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-foreground/40" />
          <div id="admin-menu" role="dialog" aria-modal="true" aria-label="Admin menu" className={cn("absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-background shadow-xl")}>
            <div className="flex h-14 items-center justify-between border-b-2 pl-5 pr-2">
              <span className="font-display text-lg font-semibold">JAMB Prep admin</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex size-11 items-center justify-center rounded-xl hover:bg-muted">
                <X className="size-6" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t-2 p-3">{signOut}</div>
          </div>
        </div>
      ) : null}
    </>
  );
}
