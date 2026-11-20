"use client";

import { notFound, useParams } from "next/navigation";
import { QuizRun } from "./run";
import { MIXED_ID, gameById, levelOf } from "@/lib/games/quiz/games";

export default function QuizLevelPage() {
  const { game: gameId, level: levelId } = useParams<{ game: string; level: string }>();
  const game = gameById(gameId);
  if (!game || (levelId !== MIXED_ID && !levelOf(game, levelId))) notFound();
  return <QuizRun game={game} levelId={levelId} />;
}
