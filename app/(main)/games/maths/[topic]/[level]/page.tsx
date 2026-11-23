"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MathsPlayer } from "@/components/games/maths-player";
import { track } from "@/lib/analytics";
import { MATHS_LEVELS, levelById, topicById } from "@/lib/games/maths/engine";
import { isUnlocked, useQuizProgress } from "@/lib/games/quiz/progress";

export default function MathsLevelPage() {
  const { topic: topicId, level: levelId } = useParams<{ topic: string; level: string }>();
  const topic = topicById(topicId);
  if (!topic || !levelById(levelId)) notFound();
  return <Run topicId={topic.id} topicName={topic.name} levelId={levelId} />;
}

function Run({ topicId, topicName, levelId }: { topicId: string; topicName: string; levelId: string }) {
  const router = useRouter();
  const gameId = `maths-${topicId}`;
  const { progress, ready, record } = useQuizProgress({ id: gameId });
  // A new key gives "Play again" a fresh draw.
  const [attempt, setAttempt] = useState(0);
  const asGame = { levels: MATHS_LEVELS };
  const open = isUnlocked(asGame, progress, levelId);
  const playing = ready && open;
  const back = `/games/maths/${topicId}`;

  useEffect(() => {
    if (playing) void track("game_started", { game: gameId, level: levelId, attempt });
  }, [playing, gameId, levelId, attempt]);

  useEffect(() => {
    if (ready && !open) router.replace(back);
  }, [ready, open, router, back]);

  if (!playing) return <div className="min-h-dvh" aria-busy="true" />;

  return (
    <MathsPlayer
      key={`${levelId}-${attempt}`}
      topicId={topicId}
      topicName={topicName}
      levelId={levelId}
      back={back}
      onFinish={(stars, correct) => {
        record(levelId, stars, correct);
        void track("game_completed", { game: gameId, level: levelId, stars, correct });
      }}
      onAgain={() => setAttempt((a) => a + 1)}
    />
  );
}
