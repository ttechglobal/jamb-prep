import { supabase } from "@/lib/supabase/client";

/** Where a visitor's referral code waits between opening an ambassador's link and signing up. */
export const REFERRAL_KEY = "jp:ref";

/** A code is six letters or digits. Anything else typed or stored is ignored. */
export const cleanReferralCode = (raw: unknown) => {
  const code = String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return code.length === 6 ? code : null;
};

export function savedReferral(): string | null {
  try {
    return cleanReferralCode(localStorage.getItem(REFERRAL_KEY));
  } catch {
    return null;
  }
}

export function saveReferral(code: string) {
  try {
    localStorage.setItem(REFERRAL_KEY, code);
  } catch {
    // Private mode: the visitor can still type the code on the sign-up form.
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(REFERRAL_KEY);
  } catch {}
}

/** The ambassador's first name for a code, or null when no one has it. */
export async function referralOwner(code: string): Promise<string | null> {
  const { data, error } = await supabase().rpc("referral_owner", { p_code: code });
  return error ? null : ((data as string | null) ?? null);
}
