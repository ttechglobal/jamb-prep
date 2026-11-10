import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { logout } from "@/app/admin/actions";
import { AdminSidebar } from "@/components/admin/sidebar";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const signOut = (
    <form action={logout}>
      <button type="submit" className="flex h-11 w-full items-center gap-3 rounded-xl px-3 font-display font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">
        <LogOut className="size-5" aria-hidden />
        Sign out
      </button>
    </form>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <AdminSidebar signOut={signOut} />
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
