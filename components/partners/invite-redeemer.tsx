"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { INVITE_KEY, partnerAction } from "@/lib/partners/client";

/**
 * A friend who opened an invite link and then signed up arrives in the app with the code saved.
 * Once they are in, the request is sent for them. The code is cleared either way, so it never loops.
 */
export function InviteRedeemer() {
  const { hydrated, account, profile } = useAppState();

  useEffect(() => {
    if (!hydrated || !account || !profile) return;
    let code: string | null = null;
    try {
      code = localStorage.getItem(INVITE_KEY);
      if (code) localStorage.removeItem(INVITE_KEY);
    } catch {
      return;
    }
    if (!code) return;
    partnerAction({ action: "request", code })
      .then(({ status }) => {
        void track(status === "active" ? "partner_accepted" : "partner_request_sent");
        toast.success(status === "active" ? "You're now study partners" : "Study request sent");
      })
      .catch(() => {});
  }, [hydrated, account, profile]);

  return null;
}
