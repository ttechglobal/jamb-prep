"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { INVITE_KEY, partnerAction } from "@/lib/partners/client";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Where an invite link lands. The code is kept so it still works after the friend signs up. */
export default function JoinPage() {
  const code = String(useParams<{ code: string }>().code ?? "").toUpperCase().slice(0, 6);
  const router = useRouter();
  const { hydrated, account, profile } = useAppState();
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {
      // Private mode: the friend can still enter the code by hand.
    }
    supabase()
      .rpc("partner_code_owner", { p_code: code })
      .then(({ data, error }) => setName(error ? null : ((data as string | null) ?? null)));
  }, [code]);

  async function join() {
    setJoining(true);
    try {
      const { status } = await partnerAction({ action: "request", code });
      try {
        localStorage.removeItem(INVITE_KEY);
      } catch {}
      void track(status === "active" ? "partner_accepted" : "partner_request_sent");
      toast.success(status === "active" ? "You're now study partners" : "Request sent");
      router.push("/partners");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join. Try again.");
      setJoining(false);
    }
  }

  const ready = hydrated && name !== undefined;
  const signedIn = Boolean(account && profile);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="flex flex-1 flex-col justify-center">
        {!ready ? (
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading" />
        ) : name === null ? (
          <div className="game-card p-6 text-center">
            <h1 className="text-2xl font-semibold">That invite link isn&apos;t valid</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ask your friend to send it again.</p>
            <Link href="/" className={cn(buttonVariants({ size: "xl" }), "mt-5 w-full")}>
              Go to JAMBprep
            </Link>
          </div>
        ) : (
          <div className="game-card p-6 text-center">
            <span aria-hidden className="mx-auto grid size-16 place-items-center rounded-2xl bg-sky-soft text-sky">
              <Users className="size-8" />
            </span>
            <h1 className="mt-3 text-2xl font-semibold">{name} wants to study with you</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Practise together, see each other&apos;s streaks and nudge each other to keep going.
            </p>
            {signedIn ? (
              <Button size="xl" className="mt-5 w-full" disabled={joining} onClick={join}>
                {joining ? <Loader2 className="animate-spin" aria-hidden /> : `Study with ${name}`}
              </Button>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <Link href="/register" className={cn(buttonVariants({ size: "xl" }), "w-full")}>
                  Create free account
                </Link>
                <Link href="/login" className={cn(buttonVariants({ size: "xl", variant: "outline" }), "w-full")}>
                  I already have an account
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
