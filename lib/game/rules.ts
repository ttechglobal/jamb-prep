import type { PlayerProgress, SessionResult, SessionReward } from "@/lib/types";

/**
 * Prototype game rules, pure so they can be unit tested and later mirrored on the server.
 * XP reflects effort and practice only. It must never be presented as a predicted UTME score.
 */

export const XP = { correct: 2, finish: 2, threeStars: 2 } as const;
export const DAILY_GOAL_QUESTIONS = 15;
/** Rounds a guest can start before they must create an account. */
export const GUEST_FREE_ROUNDS = 2;

const TITLES = [
  { from: 1, title: "Aspirant" },
  { from: 3, title: "Candidate" },
  { from: 5, title: "Scholar" },
  { from: 8, title: "Ace" },
  { from: 11, title: "Legend" },
];

export const emptyProgress = (): PlayerProgress => ({
  xp: 0,
  currentStreak: 0,
  bestStreak: 0,
  lastPracticeDay: null,
  dayQuestions: 0,
  sessionsCompleted: 0,
  questionsAnswered: 0,
  subjects: {},
});

/** Local calendar day, so a streak matches the student's own midnight. */
export function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** Total XP needed to reach a level: each level takes 100 XP more than the last. */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelFor(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const title = [...TITLES].reverse().find((t) => level >= t.from)?.title ?? TITLES[0].title;
  return { level, title, floor, next, toNext: next - xp, percent: Math.round(((xp - floor) / (next - floor)) * 100) };
}

export function starsFor(accuracy: number): SessionReward["stars"] {
  if (accuracy >= 90) return 3;
  if (accuracy >= 70) return 2;
  if (accuracy >= 40) return 1;
  return 0;
}

export function xpForResult(result: Pick<SessionResult, "correct" | "answered" | "accuracy">) {
  if (result.answered === 0) return 0;
  return result.correct * XP.correct + XP.finish + (starsFor(result.accuracy) === 3 ? XP.threeStars : 0);
}

/** Streak still alive today? A missed day shows 0 even before the next session is recorded. */
export function liveStreak(progress: PlayerProgress, today = dayKey()) {
  if (!progress.lastPracticeDay) return 0;
  return daysBetween(progress.lastPracticeDay, today) <= 1 ? progress.currentStreak : 0;
}

export function questionsToday(progress: PlayerProgress, today = dayKey()) {
  return progress.lastPracticeDay === today ? progress.dayQuestions : 0;
}

export function applyResult(progress: PlayerProgress, result: SessionResult, today: string) {
  const xpGained = xpForResult(result);
  const stars = starsFor(result.accuracy);
  const practisedToday = result.answered > 0;

  let currentStreak = liveStreak(progress, today);
  if (practisedToday && progress.lastPracticeDay !== today) currentStreak += 1;

  const subjects = { ...progress.subjects };
  for (const row of result.review) {
    if (row.selected === null) continue;
    const s = subjects[row.question.subjectId] ?? { answered: 0, correct: 0 };
    subjects[row.question.subjectId] = {
      answered: s.answered + 1,
      correct: s.correct + (row.selected === row.reveal.correctOption ? 1 : 0),
    };
  }

  const next: PlayerProgress = {
    xp: progress.xp + xpGained,
    currentStreak,
    bestStreak: Math.max(progress.bestStreak, currentStreak),
    lastPracticeDay: practisedToday ? today : progress.lastPracticeDay,
    dayQuestions: practisedToday ? questionsToday(progress, today) + result.answered : progress.dayQuestions,
    sessionsCompleted: progress.sessionsCompleted + 1,
    questionsAnswered: progress.questionsAnswered + result.answered,
    subjects,
  };

  const reward: SessionReward = {
    sessionId: result.sessionId,
    xpGained,
    stars,
    levelBefore: levelFor(progress.xp).level,
    levelAfter: levelFor(next.xp).level,
    streak: currentStreak,
  };

  return { progress: next, reward };
}
