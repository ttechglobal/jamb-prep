import data from "./english.json";

/**
 * The English games that are not Concord: pick the right answer from two to four choices.
 * Content is shared with the mobile app (same levels, same wording).
 */
export interface QuizItem {
  text: string;
  answer: string;
  options: string[];
  why: string;
}

export interface QuizLevel {
  id: string;
  title: string;
  question: string;
  rule: string[];
  items: QuizItem[];
}

export interface QuizGame {
  id: string;
  name: string;
  tagline: string;
  /** Short caption above the question, e.g. "OPPOSITE IN MEANING". */
  label: string;
  colour: string;
  levels: QuizLevel[];
}

export const QUIZ_GAMES = data as QuizGame[];
export const MIXED_ID = "mixed";
export const ROUNDS_PER_LEVEL = 2;
export const ITEMS_PER_ROUND = 5;
export const ITEMS_PER_LEVEL = ROUNDS_PER_LEVEL * ITEMS_PER_ROUND;

export const gameById = (id: string) => QUIZ_GAMES.find((g) => g.id === id);
export const levelOf = (game: QuizGame, levelId: string) => game.levels.find((l) => l.id === levelId);

function shuffle<T>(list: readonly T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ten items for one level, or ten from every level for Mixed, with the choices shuffled. */
export function drawItems(game: QuizGame, levelId: string): QuizItem[] {
  const pool = levelId === MIXED_ID ? game.levels.flatMap((l) => l.items) : (levelOf(game, levelId)?.items ?? []);
  return shuffle(pool)
    .slice(0, ITEMS_PER_LEVEL)
    .map((item) => ({ ...item, options: shuffle(item.options) }));
}

export function quizStars(correct: number, total = ITEMS_PER_LEVEL): 0 | 1 | 2 | 3 {
  const pct = (correct / total) * 100;
  if (pct >= 93) return 3;
  if (pct >= 80) return 2;
  if (pct >= 67) return 1;
  return 0;
}
