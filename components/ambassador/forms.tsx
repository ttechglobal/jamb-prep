"use client";

import Link from "next/link";
import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { ambassadorLogin, ambassadorSignup, type AmbassadorFormState } from "@/app/ambassador/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const none: AmbassadorFormState = {};

function Field({ id, label, ...props }: { id: string; label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} required className="h-12 text-base" {...props} />
    </div>
  );
}

export function AmbassadorLoginForm() {
  const [state, action, pending] = useActionState(ambassadorLogin, none);
  return (
    <form action={action} className="game-card space-y-4 p-6 sm:p-7">
      <div>
        <h1 className="text-2xl font-semibold">Ambassador sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">See your link, your sign-ups and what you have earned.</p>
      </div>
      <Field id="email" label="Email" type="email" autoComplete="email" autoFocus />
      <Field id="password" label="Password" type="password" autoComplete="current-password" />
      {state.error ? <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p> : null}
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Sign in
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        New here? <Link href="/ambassador/signup" className="font-semibold text-primary hover:underline">Become an ambassador</Link>
      </p>
    </form>
  );
}

export function AmbassadorSignupForm() {
  const [state, action, pending] = useActionState(ambassadorSignup, none);
  return (
    <form action={action} className="game-card space-y-4 p-6 sm:p-7">
      <div>
        <h1 className="text-2xl font-semibold">Become an ambassador</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Share JAMB Prep with students and earn 20% of what each student you bring in pays.
        </p>
      </div>
      <Field id="name" label="Your name" autoComplete="name" autoFocus maxLength={60} />
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field id="password" label="Password" type="password" autoComplete="new-password" minLength={8} />
      {state.error ? <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p> : null}
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Create ambassador account
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Already an ambassador? <Link href="/ambassador" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </form>
  );
}

/** The link and code, ready to copy or send on WhatsApp. The address is read in the browser so it is always the live one. */
export function ShareCard({ code }: { code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  // The address is read in the browser, so it is always the live one (local, preview or production).
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    queueMicrotask(() => setOrigin(window.location.origin));
  }, []);
  const link = `${origin}/r/${code}`;

  async function copy(what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(what === "link" ? link : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard blocked: the text is on screen to select by hand.
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Prepare for JAMB with free practice questions, timed drills and CBT mocks on JAMB Prep. Create your account here: ${link}`)}`;

  return (
    <section className="game-card space-y-4 p-5" aria-label="Your referral link">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Your referral code</p>
        <div className="mt-1 flex items-center gap-3">
          <p className="font-display text-4xl font-semibold tracking-[0.12em]">{code}</p>
          <Button type="button" variant="outline" size="lg" onClick={() => copy("code")}>
            {copied === "code" ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied === "code" ? "Copied" : "Copy code"}
          </Button>
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Your referral link</p>
        <p className="mt-1 break-all rounded-xl bg-muted px-3 py-2.5 text-sm font-medium">
          {origin ? link : `/r/${code}`}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="button" size="xl" onClick={() => copy("link")} className="sm:flex-1">
          {copied === "link" ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied === "link" ? "Link copied" : "Copy link"}
        </Button>
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(buttonVariants({ size: "xl", variant: "outline" }), "sm:flex-1")}
        >
          <Share2 aria-hidden />
          Share on WhatsApp
        </a>
      </div>
    </section>
  );
}

