"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/lib/app-state";

/**
 * The full app is for students who have signed up and finished setup.
 * Guests stay in the simple loop at /start: pick a subject, five questions, results.
 */
export function AccountGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { hydrated, account, profile } = useAppState();

  useEffect(() => {
    if (!hydrated) return;
    if (!account) router.replace("/start");
    else if (!profile) router.replace("/onboarding");
  }, [account, hydrated, profile, router]);

  if (!hydrated || !account || !profile) return <div className="min-h-dvh" aria-busy="true" />;
  return children;
}
