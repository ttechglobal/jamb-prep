import type {
  OptionKey,
  PlayerProgress,
  PracticeSession,
  Profile,
  QuestionReveal,
  SessionConfig,
  SessionResult,
  SessionReward,
  Topic,
} from "@/lib/types";

/** The only way UI code talks to data. Sign-in itself lives in lib/app-state.tsx. */
export interface DataSource {
  listTopics(subjectId: string): Promise<Topic[]>;
  /** Number of published questions available for a subject (and optional topic). */
  countQuestions(subjectId: string, topicId?: string | null): Promise<number>;
  startSession(config: SessionConfig): Promise<PracticeSession>;
  /** Returns null if not found. Expired timed sessions come back already finalised. */
  getSession(id: string): Promise<PracticeSession | null>;
  /** Autosaves one answer. In instant-feedback sessions the answer is locked and revealed. */
  saveAnswer(sessionId: string, questionId: string, option: OptionKey): Promise<{ reveal?: QuestionReveal }>;
  submitSession(id: string): Promise<SessionResult>;
  getResult(id: string): Promise<SessionResult | null>;
  /** Rounds started by this guest. Always 0 for signed-in students. */
  guestRoundsUsed(): Promise<number>;
  getProgress(): Promise<PlayerProgress>;
  /** Idempotent per session: a second call returns the original reward. */
  recordResult(result: SessionResult): Promise<{ progress: PlayerProgress; reward: SessionReward }>;
  /** Null until the student has finished setup. */
  getProfile(): Promise<Profile | null>;
  saveProfile(profile: Profile): Promise<void>;
  reportQuestion(questionId: string): Promise<void>;
}

/** A guest has used their free rounds and must create an account to continue. */
export class AccountRequiredError extends Error {
  constructor() {
    super("Create a free account to keep practising.");
    this.name = "AccountRequiredError";
  }
}

export class SessionClosedError extends Error {
  constructor() {
    super("This session has already ended.");
    this.name = "SessionClosedError";
  }
}
