import type { Metadata } from "next";
import { Suspense } from "react";
import { LandingPage } from "@/components/landing/landing-page";
import { SaveReferral } from "@/components/referral/save-referral";
import { adminDb } from "@/lib/admin/auth";
import { cleanReferralCode } from "@/lib/referral/client";

export const metadata: Metadata = {
  title: "Welcome to JAMB Prep",
  description: "Free JAMB UTME practice. Create your account and start practising.",
};

/** Where an ambassador's link lands: the main landing page, plus who invited the visitor. */
export default function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-brand-deep" aria-busy="true" />}>
      <Welcome params={params} />
    </Suspense>
  );
}

async function Welcome({ params }: { params: Promise<{ code: string }> }) {
  const code = cleanReferralCode((await params).code);
  const { data } = code ? await adminDb().rpc("referral_owner", { p_code: code }) : { data: null };
  const from = typeof data === "string" && data ? data : null;
  // A code that matches no one is not kept, and the page still welcomes the visitor.
  const valid = Boolean(code && from);

  return (
    <>
      {valid && code ? <SaveReferral code={code} /> : null}
      <LandingPage from={from} />
    </>
  );
}
