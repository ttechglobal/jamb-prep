"use client";

import Link from "next/link";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="game-card p-6 sm:p-7">
      {sent ? (
        <div className="text-center" role="status">
          <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
          <h1 className="mt-3 text-2xl font-semibold">Check your email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            If an account exists for that address, we&apos;ve sent a link to reset your password.
          </p>
        </div>
      ) : (
        <>
          <h1 className="text-2xl font-semibold">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">We&apos;ll email you a reset link.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
              // Always shows the same message, so this page can't reveal who has an account.
              await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
              setSent(true);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" className="h-12 text-base" />
            </div>
            <Button type="submit" size="xl" className="w-full">Send reset link</Button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="font-semibold text-primary hover:underline">Back to sign in</Link>
      </p>
    </div>
  );
}
