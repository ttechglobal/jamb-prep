"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { QuizPlayer } from "@/components/games/quiz-player";
import { track } from "@/lib/analytics";
import { MIXED_ID, type QuizGame } from "@/lib/games/quiz/games";
import { isUnlocked, mixedUnlocked, useQuizProgress } from "@/lib/games/quiz/progress";

export function QuizRun({ game, levelId }: { game: QuizGame; levelId: string }) {
  const router = useRouter();
  const { progress, ready, record } = useQuizProgress(game);
  // A new key gives "Play again" a fresh draw.
  const [attempt, setAttempt] = useState(0);
  const open = levelId === MIXED_ID ? mixedUnlocked(game, progress) : isUnlocked(game, progress, levelId);
  const playing = ready && open;

  useEffect(() => {
    if (playing) void track("game_started", { game: game.id, level: levelId, attempt });
  }, [playing, game.id, levelId, attempt]);

  useEffect(() => {
    if (ready && !open) router.replace(`/games/play/${game.id}`);
  }, [ready, open, router, game.id]);

  if (!playing) return <div className="min-h-dvh" aria-busy="true" />;

  return (
    <QuizPlayer
      key={`${levelId}-${attempt}`}
      game={game}
      levelId={levelId}
      onFinish={(stars, correct) => {
        record(levelId, stars, correct);
        void track("game_completed", { game: game.id, level: levelId, stars, correct });
      }}
      onAgain={() => setAttempt((a) => a + 1)}
    />
  );
}
