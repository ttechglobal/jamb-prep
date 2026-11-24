import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = { title: "Ambassadors", robots: { index: false, follow: false } };

export default function AmbassadorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-4">
        <Logo />
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">Ambassador</span>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-12 pt-4">{children}</main>
    </div>
  );
}
