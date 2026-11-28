import { AppNudges } from "@/components/pwa/app-nudges";
import { InviteRedeemer } from "@/components/partners/invite-redeemer";
import { AccountGate } from "@/components/layout/account-gate";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppShell } from "@/components/layout/app-shell";
import { AppHeader } from "@/components/layout/app-header";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <AccountGate>
      <AppShell>
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 sm:pb-10 sm:pt-6">{children}</main>
        <AppNudges />
        <InviteRedeemer />
        <BottomNav />
      </AppShell>
    </AccountGate>
  );
}
