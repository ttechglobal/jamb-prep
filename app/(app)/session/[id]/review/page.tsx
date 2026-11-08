"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AnswerReview } from "@/components/results/answer-review";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { data } from "@/lib/data";
import type { SessionResult } from "@/lib/types";

export default function ReviewPage() {
  return (
    <Suspense fallback={<ReviewSkeleton />}>
      <Review />
    </Suspense>
  );
}

function ReviewSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4" aria-busy="true" aria-label="Loading review">
      <Skeleton className="h-4 rounded-full" />
      <Skeleton className="mt-6 h-24 rounded-2xl" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}

function Review() {
  const { id } = useParams<{ id: string }>();
  const subject = useSearchParams().get("s");
  const [result, setResult] = useState<SessionResult | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    data.getResult(id).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (result === undefined) return <ReviewSkeleton />;

  if (result === null) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-semibold">Nothing to review yet</h1>
        <p className="mt-2 text-muted-foreground">Answers can be reviewed once a session is finished.</p>
        <Link href="/start" className={buttonVariants({ size: "xl", className: "mt-6 w-full" })}>
          Start practising
        </Link>
      </main>
    );
  }

  return <AnswerReview result={result} initialSubject={subject} />;
}
