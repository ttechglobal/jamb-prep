"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useAppState } from "@/lib/app-state";
import { cn } from "@/lib/utils";

/** Guest-first: straight to picking a subject. Signed-in students go to their Practice home. */
export function StartPractisingButton() {
  const { account } = useAppState();

  return (
    <Link
      href={account ? "/practice" : "/start"}
      onClick={() => void track("start_click", { signedIn: Boolean(account) })}
      className={cn(buttonVariants({ size: "xl", variant: "gold" }), "w-full sm:w-auto")}>
      Start Practising
      <ArrowRight aria-hidden />
    </Link>
  );
}
