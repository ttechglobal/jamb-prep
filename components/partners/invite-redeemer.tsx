"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { INVITE_KEY, PartnerError, cleanInviteCode, inviterName, partnerAction, savedInvite } from "@/lib/partners/client";
import { currentSession, supabase } from "@/lib/supabase/client";

/** Answers where retrying cannot help, so the saved invite is dropped. */
const FINAL = new Set(["invalid_code", "own_code", "already_partners", "too_many_partners"]);

/**
 * Someone who signed up from a friend's invite link is a study partner as soon as they are in the app.
 * Signing up is the acceptance, so nothing is asked of them. The code comes from the account itself (put
 * there at sign-up, so it survives a confirmation link opened in another browser) or from this device.
 * It is cleared only once the answer is final, so a dropped connection tries again next time.
 */
export function InviteRedeemer() {
  const router = useRouter();
  const { hydrated, account, profile } = useAppState();
  const started = useRef(false);

  useEffect(() => {
    if (!hydrated || !account || !profile || started.current) return;
    started.current = true;

    (async () => {
      const session = await currentSession();
      const inAccount = cleanInviteCode(session?.user.user_metadata?.invite_code);
      const code = inAccount ?? savedInvite();
      if (!code) return;

      const clear = async () => {
        try {
          localStorage.removeItem(INVITE_KEY);
        } catch {}
        if (inAccount) await supabase().auth.updateUser({ data: { invite_code: null } }).catch(() => {});
      };

      try {
        const name = await inviterName(code);
        await partnerAction({ action: "accept_invite", code });
        void track("partner_accepted");
        toast.success(name ? `${name} invited you to study. You're now study partners.` : "You're now study partners.", {
          action: { label: "See", onClick: () => router.push("/partners") },
        });
        await clear();
      } catch (err) {
        const failure = err instanceof PartnerError ? err : null;
        if (failure && FINAL.has(failure.code)) {
          await clear();
          // Already partners, an old link or their own link are nothing to report. A full list is.
          if (failure.code === "too_many_partners") toast.error(failure.message);
        } else {
          toast.error("We couldn't add your study partner yet. We'll try again next time you open the app.");
        }
      }
    })();
  }, [hydrated, account, profile, router]);

  return null;
}
