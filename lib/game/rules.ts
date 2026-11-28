import type { PlayerProgress, SessionResult, SessionReward } from "@/lib/types";

/**
 * Prototype game rules, pure so they can be unit tested and later mirrored on the server.
 * XP reflects effort and practice only. It must never be presented as a predicted UTME score.
 */

export const XP = { correct: 2, finish: 2, threeStars: 2 } as const;
export const DAILY_GOAL_QUESTIONS = 15;
/** Rounds a guest can start before they must create an account. */
export const GUEST_FREE_ROUNDS = 2;

/** Ranks, from the level each one starts at. A student keeps a rank until the next one begins. */
export const RANKS = [
  { from: 1, title: "Aspirant" },
  { from: 3, title: "Candidate" },
  { from: 6, title: "Scholar" },
  { from: 10, title: "Prefect" },
  { from: 15, title: "Ace" },
  { from: 20, title: "Distinction" },
  { from: 30, title: "Legend" },
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

/**
 * Total XP needed to reach a level. The first levels come quickly (level 2 is 50 XP, about two rounds) so a new
 * student is rewarded early, then each level asks for 20 XP more than the one before: 50, 70, 90, 110...
 * Level 10 is 1,170 XP and level 30 is 9,570 XP.
 */
export const xpForLevel = (level: number) => 10 * (level - 1) * (level + 3);

export function levelFor(xp: number) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const rank = [...RANKS].reverse().find((t) => level >= t.from) ?? RANKS[0];
  const nextRank = RANKS.find((t) => t.from > level) ?? null;
  return {
    level,
    title: rank.title,
    /** The next rank and the level it begins at, or null at the top. */
    nextRank,
    floor,
    next,
    toNext: next - xp,
    percent: Math.round(((xp - floor) / (next - floor)) * 100),
  };
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
