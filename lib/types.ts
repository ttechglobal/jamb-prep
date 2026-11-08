/**
 * Domain types shared by the UI and every data source (mock now, Supabase later).
 * Keep these free of storage details so the data layer can be swapped without UI changes.
 */

import type { Block, OptionKey, PrescribedWorkRef, QuestionOption, SharedContext, Solution } from "@/lib/content/types";

export type { OptionKey } from "@/lib/content/types";

export interface Subject {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  isCompulsory: boolean;
}

export interface Topic {
  id: string;
  subjectId: string;
  name: string;
}

/** A question as the client may see it BEFORE answering — no correct answer, no explanation. */
export interface PublicQuestion {
  id: string;
  subjectId: string;
  topicId: string | null;
  topicName?: string | null;
  instruction: Block[] | null;
  /** Passage, poem, table or figure shared with other questions. */
  context: SharedContext | null;
  work: PrescribedWorkRef | null;
  stem: Block[];
  options: QuestionOption[];
}

/** Revealed only after an answer is locked (instant feedback) or after submission. */
export interface QuestionReveal {
  questionId: string;
  correctOption: OptionKey;
  solution: Solution | null;
}

export type PracticeMode = "quick_five" | "subject" | "timed" | "mock";

export interface SessionConfig {
  mode: PracticeMode;
  subjectIds: string[];
  topicId?: string | null;
  /** Total questions; for mock this is derived from the exam format. */
  count: number;
  durationSec?: number | null;
  /** instant = reveal after each answer; end = reveal on results. */
  feedback: "instant" | "end";
}

export type SessionStatus = "in_progress" | "submitted" | "expired";

export interface SessionQuestion {
  position: number;
  question: PublicQuestion;
}

export interface PracticeSession {
  id: string;
  config: SessionConfig;
  status: SessionStatus;
  startedAt: string;
  deadlineAt: string | null;
  questions: SessionQuestion[];
  answers: Record<string, OptionKey>;
  /** Present for answered questions in instant-feedback sessions. */
  reveals: Record<string, QuestionReveal>;
}

export interface SubjectResult {
  subjectId: string;
  total: number;
  correct: number;
  /** Mock only: UTME-style subject score out of 100. */
  scaledScore?: number;
}

export interface SessionResult {
  sessionId: string;
  config: SessionConfig;
  total: number;
  answered: number;
  correct: number;
  accuracy: number;
  durationSec: number;
  bySubject: SubjectResult[];
  /** Mock only: total out of 400. */
  utmeScore?: number;
  /** Awarded by the server when the session closes. */
  reward?: SessionReward;
  review: {
    question: PublicQuestion;
    selected: OptionKey | null;
    reveal: QuestionReveal;
  }[];
}

export interface Profile {
  displayName: string;
  subjectIds: string[];
  /** Target out of 100 for each chosen subject. */
  subjectTargets: Record<string, number>;
}

/** Student progress shown across the UI. Today: local sample data. Later: server rollups. */
export interface PlayerProgress {
  xp: number;
  currentStreak: number;
  bestStreak: number;
  /** Local calendar day (YYYY-MM-DD) of the most recent completed session. */
  lastPracticeDay: string | null;
  /** Questions answered on `lastPracticeDay`, used for the daily goal. */
  dayQuestions: number;
  sessionsCompleted: number;
  questionsAnswered: number;
  subjects: Record<string, { answered: number; correct: number }>;
}

/** What one finished session earned. Stored so reopening results never awards twice. */
export interface SessionReward {
  sessionId: string;
  xpGained: number;
  stars: 0 | 1 | 2 | 3;
  levelBefore: number;
  levelAfter: number;
  streak: number;
}
