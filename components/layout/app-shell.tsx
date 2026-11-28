"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { isFocusedPage } from "@/lib/games/session-route";
import { cn } from "@/lib/utils";

/** The frame around every signed-in page. On a wide screen the sidebar takes the left, and the page sits beside it. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className={cn("flex min-h-dvh flex-col", !isFocusedPage(pathname) && "lg:pl-64")}>
      <AppSidebar />
      {children}
    </div>
  );
}
