/**
 * UTME format. Verified 7 Nov 2026 against JAMB's 2026 UTME Manual for Officials:
 * English 60 questions, each other subject 40 (180 total), 120 minutes, each subject /100, total /400.
 *
 * In production this lives in the `exam_formats` table so a format change is a data edit,
 * not a deploy. RE-VERIFY against official JAMB guidance before every release season.
 */
export const UTME_FORMAT = {
  name: "UTME 2026",
  durationSec: 120 * 60,
  compulsorySubjectSlug: "english",
  compulsoryQuestionCount: 60,
  otherQuestionCount: 40,
  maxPerSubject: 100,
  maxTotal: 400,
  subjectCount: 4,
} as const;

export const SUBJECT_TARGET = { min: 0, max: 100, step: 5, default: 70 } as const;

export const QUICK_FIVE_COUNT = 5;

export const TIMED_PRESETS = {
  counts: [10, 20, 30, 40],
  durationsMin: [5, 10, 15, 20, 30],
  defaultCount: 20,
  defaultDurationMin: 15,
} as const;
