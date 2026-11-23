"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { INVITE_KEY, cleanInviteCode, inviterName, partnerAction } from "@/lib/partners/client";
import { cn } from "@/lib/utils";

/** Where an invite link lands. The code is kept so it still works after the friend signs up. */
export default function JoinPage() {
  // The code comes from the URL at request time, so the page streams in behind a Suspense boundary.
  return (
    <Suspense fallback={<div className="min-h-dvh" aria-busy="true" />}>
      <Join />
    </Suspense>
  );
}

function Join() {
  const code = cleanInviteCode(useParams<{ code: string }>().code) ?? "";
  const router = useRouter();
  const { hydrated, account, profile } = useAppState();
  const [name, setName] = useState<string | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) return;
    try {
      localStorage.setItem(INVITE_KEY, code);
    } catch {
      // Private mode: the code still travels with the account when they sign up.
    }
    void inviterName(code).then(setName);
  }, [code]);

  async function join() {
    setJoining(true);
    try {
      await partnerAction({ action: "accept_invite", code });
      try {
        localStorage.removeItem(INVITE_KEY);
      } catch {}
      void track("partner_accepted");
      toast.success(`You and ${name} are now study partners`);
      router.push("/partners");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't join. Try again.");
      setJoining(false);
    }
  }

  // No code in the link means there is no one to look up.
  const owner = code ? name : null;
  const ready = hydrated && owner !== undefined;
  const signedIn = Boolean(account && profile);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-6">
      <Logo />
      <main className="flex flex-1 flex-col justify-center">
        {!ready ? (
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" aria-label="Loading" />
        ) : owner === null ? (
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
            <h1 className="mt-3 text-2xl font-semibold">{name} invited you to study together</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Practise together, see each other&apos;s streaks and nudge each other to keep going.
            </p>
            {signedIn ? (
              <Button size="xl" className="mt-5 w-full" disabled={joining} onClick={join}>
                {joining ? <Loader2 className="animate-spin" aria-hidden /> : `Join ${name}`}
              </Button>
            ) : (
              <div className="mt-5 flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Create your account and you will be study partners right away.</p>
                <Link href="/register" className={cn(buttonVariants({ size: "xl" }), "w-full")}>
                  Create an account to join {name}
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
