import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Flame, Timer } from "lucide-react";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { SaveReferral } from "@/components/referral/save-referral";
import { buttonVariants } from "@/components/ui/button";
import { adminDb } from "@/lib/admin/auth";
import { cleanReferralCode } from "@/lib/referral/client";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Welcome to JAMB Prep",
  description: "Free JAMB UTME practice. Create your account and start practising.",
};

const POINTS = [
  { icon: BookOpenCheck, title: "Real past-question practice", text: "Quick rounds in every subject, each answer explained." },
  { icon: Timer, title: "Full CBT mock exams", text: "Sit the exam the way JAMB sets it, with the clock running." },
  { icon: Flame, title: "Streaks and XP", text: "A few minutes a day, and you can see yourself improve." },
];

/** Where an ambassador's link lands. The code is kept so the sign-up form already has it. */
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
    <div className="flex min-h-dvh flex-col">
      {valid && code ? <SaveReferral code={code} /> : null}
      <div className="flex-1 bg-brand-deep text-white">
        <header className="mx-auto flex h-14 w-full max-w-3xl items-center px-4">
          <Logo tone="light" />
        </header>
        <section className="mx-auto w-full max-w-3xl px-4 pb-12 pt-8 sm:pt-14">
          {from ? <p className="font-display text-sm font-semibold tracking-wide text-gold">{from} invited you</p> : <p className="font-display text-sm font-semibold tracking-wide text-gold">For JAMB UTME candidates</p>}
          <h1 className="mt-2 text-[2.4rem] font-semibold leading-[1.05] text-balance sm:text-6xl">Welcome to JAMB Prep</h1>
          <p className="mt-4 max-w-lg text-lg leading-snug text-white/80 text-pretty">
            Practise for your UTME the way it will feel on exam day. Create your free account and start practising in a minute.
          </p>
          <Link href="/register" className={cn(buttonVariants({ size: "xl", variant: "gold" }), "mt-7 w-full sm:w-auto")}>
            Create account and start practising
            <ArrowRight aria-hidden />
          </Link>
          <p className="mt-3 text-sm text-white/70">
            Already have an account? <Link href="/login" className="font-semibold text-white underline">Sign in</Link>
          </p>

          <ul className="mt-10 grid gap-3 sm:grid-cols-3">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-2xl bg-white/10 p-4">
                <Icon className="size-6 text-gold" aria-hidden />
                <p className="mt-2 font-display font-semibold">{title}</p>
                <p className="mt-1 text-sm text-white/75">{text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <footer className="mx-auto w-full max-w-3xl px-4 py-6 text-xs text-muted-foreground">
        JAMB Prep is an independent practice tool by Exam Prep A1 and is not affiliated with JAMB.
      </footer>
    </div>
  );
}
