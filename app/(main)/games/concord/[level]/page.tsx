"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConcordPlayer } from "@/components/games/concord-player";
import { track } from "@/lib/analytics";
import { MIXED_ID, levelById } from "@/lib/games/concord/levels";
import { isUnlocked, mixedUnlocked, useConcordProgress } from "@/lib/games/concord/progress";

export default function ConcordLevelPage() {
  const { level: levelId } = useParams<{ level: string }>();
  const router = useRouter();
  const { progress, ready, record } = useConcordProgress();
  // A new key gives "Play again" a fresh draw of sentences.
  const [attempt, setAttempt] = useState(0);

  const known = levelId === MIXED_ID || Boolean(levelById(levelId));
  const open = levelId === MIXED_ID ? mixedUnlocked(progress) : isUnlocked(progress, levelId);

  const playing = ready && known && open;
  useEffect(() => {
    if (playing) void track("game_started", { game: "concord", level: levelId, attempt });
  }, [playing, levelId, attempt]);

  useEffect(() => {
    if (ready && known && !open) router.replace("/games/concord");
  }, [ready, known, open, router]);

  if (!known) notFound();
  if (!ready || !open) return <div className="min-h-dvh" aria-busy="true" />;

  return (
    <ConcordPlayer
      key={`${levelId}-${attempt}`}
      levelId={levelId}
      onFinish={(stars, correct) => {
        record(levelId, stars, correct);
        void track("game_completed", { game: "concord", level: levelId, stars, correct });
      }}
      onAgain={() => setAttempt((a) => a + 1)}
    />
  );
}
