import { AppNudges } from "@/components/pwa/app-nudges";
import { AccountGate } from "@/components/layout/account-gate";
import { AppHeader } from "@/components/layout/app-header";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <AccountGate>
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10 pt-4 sm:pt-6">{children}</main>
        <AppNudges />
      </div>
    </AccountGate>
  );
}
