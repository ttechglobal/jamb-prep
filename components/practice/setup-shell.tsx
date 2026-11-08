"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Short, focused setup screen: back link, title, a few choices, sticky Start. */
export function SetupShell({
  title,
  description,
  children,
  startLabel = "Start",
  canStart,
  starting,
  onStart,
  footerNote,
  badge,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  startLabel?: string;
  canStart: boolean;
  starting: boolean;
  onStart: () => void;
  footerNote?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/practice"
        className="-ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Practice
      </Link>
      <div className="mt-2 flex items-center gap-3">
        {badge}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold leading-tight">{title}</h1>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-6 space-y-6">{children}</div>

      <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t-2 bg-background px-4 pb-4 pt-3">
        <Button size="xl" className="w-full" disabled={!canStart || starting} onClick={onStart}>
          {starting ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {startLabel}
          {canStart && !starting ? <ArrowRight aria-hidden /> : null}
        </Button>
        {footerNote ? <p className="mt-2 text-center text-xs text-muted-foreground">{footerNote}</p> : null}
      </div>
    </div>
  );
}
