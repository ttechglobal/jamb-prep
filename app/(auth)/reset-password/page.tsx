"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

/** Landing page for the emailed reset link, which signs the student in for this one change. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="game-card p-6 sm:p-7">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Use at least 8 characters.</p>
      <form
        noValidate
        className="mt-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (password.length < 8) return setError("Password must be at least 8 characters.");
          const { error: failed } = await supabase().auth.updateUser({ password });
          if (failed) return setError("This reset link has expired. Request a new one.");
          toast.success("Password updated.");
          router.push("/practice");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            className="h-12 text-base"
            aria-invalid={!!error}
            aria-describedby={error ? "password-error" : undefined}
          />
          {error ? (
            <p id="password-error" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="xl" className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}
