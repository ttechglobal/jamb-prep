"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/lib/app-state";

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

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { login, register } = useAppState();
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const copy = COPY[mode];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      if (mode === "login") {
        await login(email, password);
        // The account gate sends students who haven't finished setup to onboarding.
        router.push("/practice");
      } else if ((await register(email, password)) === "confirm_email") {
        setConfirmEmail(email);
      } else {
        router.push("/onboarding");
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

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
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
        </div>
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
