import type { Metadata } from "next";
import Link from "next/link";
import { logout } from "@/app/admin/actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/settings", label: "Settings" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b-2 bg-background">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-2 px-4 py-2">
          <span className="mr-3 font-display text-lg font-semibold">JAMB Prep admin</span>
          <nav aria-label="Admin" className="flex flex-wrap">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="inline-flex h-11 items-center rounded-xl px-3 font-display font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action={logout} className="ml-auto">
            <button type="submit" className="inline-flex h-11 items-center rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-muted">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
