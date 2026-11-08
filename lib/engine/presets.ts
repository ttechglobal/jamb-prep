import { QUICK_FIVE_COUNT, UTME_FORMAT } from "@/lib/exam-format";
import type { SessionConfig } from "@/lib/types";

/** Every practice mode is just a preset over the shared session engine. */

export function quickFive(registeredSubjectIds: string[] | null): SessionConfig {
  // PRD MVP rule: five questions from ONE randomly chosen registered subject.
  // Guests (no subjects yet) default to Use of English.
  const pool = registeredSubjectIds?.length ? registeredSubjectIds : [UTME_FORMAT.compulsorySubjectSlug];
  const subjectId = pool[Math.floor(Math.random() * pool.length)];
  return { mode: "quick_five", subjectIds: [subjectId], count: QUICK_FIVE_COUNT, feedback: "instant" };
}

export function subjectPractice(subjectId: string, topicId: string | null, count: number): SessionConfig {
  return { mode: "subject", subjectIds: [subjectId], topicId, count, feedback: "instant" };
}

export function timedPractice(subjectId: string, count: number, durationMin: number): SessionConfig {
  return { mode: "timed", subjectIds: [subjectId], count, durationSec: durationMin * 60, feedback: "end" };
}

export function mockExam(subjectIds: string[]): SessionConfig {
  const ordered = [
    UTME_FORMAT.compulsorySubjectSlug,
    ...subjectIds.filter((s) => s !== UTME_FORMAT.compulsorySubjectSlug),
  ].slice(0, UTME_FORMAT.subjectCount);
  const count = UTME_FORMAT.compulsoryQuestionCount + (ordered.length - 1) * UTME_FORMAT.otherQuestionCount;
  return { mode: "mock", subjectIds: ordered, count, durationSec: UTME_FORMAT.durationSec, feedback: "end" };
}

export const MODE_LABEL: Record<SessionConfig["mode"], string> = {
  quick_five: "Quick Five",
  subject: "Subject Practice",
  timed: "Timed Practice",
  mock: "Mock Exam",
};
