"use client";

import { useEffect } from "react";
import { saveReferral } from "@/lib/referral/client";

/** Remembers the ambassador's code on this device, so the sign-up form fills it in. */
export function SaveReferral({ code }: { code: string }) {
  useEffect(() => saveReferral(code), [code]);
  return null;
}
