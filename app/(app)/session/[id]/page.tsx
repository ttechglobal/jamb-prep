"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SessionRunner } from "@/components/session/session-runner";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { data } from "@/lib/data";
import type { PracticeSession } from "@/lib/types";

export default function SessionPage() {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <SessionLoader />
    </Suspense>
  );
}

function SessionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4" aria-busy="true" aria-label="Loading questions">
      <Skeleton className="h-4 rounded-full" />
      <Skeleton className="mt-6 h-24 rounded-2xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function SessionLoader() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<PracticeSession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    data.getSession(id).then((s) => {
      if (cancelled) return;
      if (s && s.status !== "in_progress") router.replace(`/session/${id}/results`);
      else setSession(s);
    });
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  if (session === undefined) return <SessionSkeleton />;

  if (session === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold">We can&apos;t find this session</h1>
        <p className="mt-2 text-muted-foreground">It may have ended, or it was started on another device.</p>
        <Link href="/practice" className={buttonVariants({ size: "xl", className: "mt-6 w-full" })}>
          Back to Practice
        </Link>
      </main>
    );
  }

  return <SessionRunner initial={session} />;
}
