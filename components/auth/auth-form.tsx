"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track, trackOnce } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { normalisePhone, phoneToEmail } from "@/lib/auth/phone";
import { inviterName, savedInvite } from "@/lib/partners/client";
import { cleanReferralCode, clearReferral, referralOwner, savedReferral } from "@/lib/referral/client";

type Mode = "login" | "register";

const COPY = {
  login: { title: "Welcome back", sub: "Sign in to continue practising.", cta: "Sign in" },
  register: {
    title: "Create your free account",
    sub: "Save your XP and streak, and unlock full mock exams.",
    cta: "Create account",
  },
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Method = "phone" | "email";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { login, register } = useAppState();
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Phone first: it is what most students have, and nothing is sent to it.
  const [method, setMethod] = useState<Method>("phone");
  const [errors, setErrors] = useState<{ email?: string; password?: string; referral?: string; form?: string }>({});
  const copy = COPY[mode];

  const [inviter, setInviter] = useState<string | null>(null);
  // Typed by the student, or filled in from the ambassador's link they opened on this device.
  const [referral, setReferral] = useState("");
  useEffect(() => {
    const saved = mode === "register" ? savedReferral() : null;
    if (saved) queueMicrotask(() => setReferral(saved));
  }, [mode]);

  useEffect(() => {
    if (mode === "register") trackOnce("register_view");
  }, [mode]);

  // A friend who sent a link is named on the sign-up form, so it is clear what creating an account does.
  useEffect(() => {
    const code = mode === "register" ? savedInvite() : null;
    if (code) void inviterName(code).then(setInviter);
  }, [mode]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const typed = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const next: typeof errors = {};
    // A phone number becomes a stand-in address, so the rest of sign-up works the same for both.
    const phone = method === "phone" ? normalisePhone(typed) : null;
    const email = method === "phone" ? (phone ? phoneToEmail(phone) : "") : typed;
    if (method === "phone" ? !phone : !EMAIL_RE.test(email)) {
      next.email = method === "phone" ? "Enter a Nigerian phone number, like 0801 234 5678." : "Enter a valid email address.";
    }
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    // The referral code is optional, but one that matches no one is almost certainly a typing slip.
    const typedReferral = referral.trim();
    const referralCode = mode === "register" && typedReferral ? cleanReferralCode(typedReferral) : null;
    if (mode === "register" && typedReferral && !referralCode) next.referral = "A referral code has 6 letters or numbers.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      if (referralCode && !(await referralOwner(referralCode))) {
        setErrors({ referral: "That referral code doesn't match anyone. Check it, or clear the box to continue without one." });
        return;
      }
      if (mode === "login") {
        await login(email, password);
        // The account gate sends students who haven't finished setup to onboarding.
        router.push("/practice");
      } else {
        const result = await register(email, password, referralCode);
        clearReferral();
        void track("register_submitted", { confirmEmail: result === "confirm_email" });
        if (result === "confirm_email") setConfirmEmail(typed);
        else router.push("/onboarding");
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "That didn't work. Try again." });
    } finally {
      setPending(false);
    }
  }

  if (confirmEmail) {
    return (
      <div className="game-card p-6 text-center sm:p-7" role="status">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold">Check your email</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a link to {confirmEmail}. Open it to finish creating your account.
        </p>
      </div>
    );
  }

  return (
    <div className="game-card p-6 sm:p-7">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>
      {inviter ? (
        <p className="mt-4 rounded-xl bg-sky-soft px-3.5 py-2.5 text-sm font-medium text-sky">
          {inviter} invited you to study together. Create your account and you will be study partners.
        </p>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="email">{method === "phone" ? "Phone number" : "Email"}</Label>
            <button
              type="button"
              onClick={() => {
                setMethod(method === "phone" ? "email" : "phone");
                setErrors({});
              }}
              className="-my-2 inline-block py-2 text-sm font-medium text-primary hover:underline"
            >
              {method === "phone" ? "Use email instead" : "Use phone number instead"}
            </button>
          </div>
          <Input
            key={method}
            id="email"
            name="email"
            type={method === "phone" ? "tel" : "email"}
            autoComplete={method === "phone" ? "tel" : "email"}
            inputMode={method === "phone" ? "tel" : "email"}
            placeholder={method === "phone" ? "0801 234 5678" : undefined}
            className="h-12 text-base"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
          />
          {errors.email ? <p id="email-error" className="text-sm text-destructive">{errors.email}</p> : null}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            {mode === "login" ? (
              <Link href="/forgot-password" className="-my-2 inline-block py-2 text-sm font-medium text-primary hover:underline">
                Forgot password?
              </Link>
            ) : null}
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="h-12 text-base"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
          />
          {errors.password ? <p id="password-error" className="text-sm text-destructive">{errors.password}</p> : null}
          {mode === "register" && method === "phone" && !errors.password ? (
            <p className="text-xs text-muted-foreground">Choose one you will remember. A phone number can&apos;t get a reset link.</p>
          ) : null}
        </div>
        {mode === "register" ? (
          <div className="space-y-1.5">
            <Label htmlFor="referral">Referral code <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="referral"
              name="referral"
              value={referral}
              onChange={(e) => setReferral(e.target.value.toUpperCase())}
              autoComplete="off"
              autoCapitalize="characters"
              maxLength={12}
              placeholder="From an ambassador"
              className="h-12 text-base uppercase"
              aria-invalid={!!errors.referral}
              aria-describedby={errors.referral ? "referral-error" : undefined}
            />
            {errors.referral ? <p id="referral-error" className="text-sm text-destructive">{errors.referral}</p> : null}
          </div>
        ) : null}
        {errors.form ? <p role="alert" className="text-sm text-destructive">{errors.form}</p> : null}
        <Button type="submit" size="xl" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {copy.cta}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>New here? <Link href="/register" className="font-semibold text-primary hover:underline">Create an account</Link></>
        ) : (
          <>Already have an account? <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
