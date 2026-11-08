import { UTME_DATE } from "@/lib/exam-format";

export type Slot = "morning" | "evening";

export interface Reminder {
  title: string;
  body: string;
  tag: string;
  url: string;
}

export interface StudentSnapshot {
  firstName: string;
  /** Sum of the student's subject targets, out of 400. */
  target: number | null;
  /** Streak still alive today or yesterday; 0 when it has already lapsed. */
  streak: number;
  practisedToday: boolean;
}

const LAGOS_OFFSET_MS = 60 * 60 * 1000; // Lagos is UTC+1 all year

/** YYYY-MM-DD for the given moment in Lagos. */
export function lagosDay(now: Date) {
  return new Date(now.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

export function daysUntilExam(now: Date, examDate: string | null = UTME_DATE) {
  if (!examDate) return null;
  const days = Math.round((Date.parse(examDate) - Date.parse(lagosDay(now))) / 86_400_000);
  return days >= 0 ? days : null;
}

function dayNumber(now: Date) {
  return Math.floor(Date.parse(lagosDay(now)) / 86_400_000);
}

const pick = <T,>(list: T[], now: Date) => list[dayNumber(now) % list.length];

/**
 * What to send this student in this slot, or null to stay quiet.
 * Morning: a nudge toward their goal. Evening: only if they haven't practised yet, so a student
 * who already did their round is never nagged.
 */
export function reminderFor(slot: Slot, s: StudentSnapshot, now: Date = new Date()): Reminder | null {
  const url = "/practice";
  const name = s.firstName;
  const days = daysUntilExam(now);

  if (slot === "evening") {
    if (s.practisedToday) return null;
    if (s.streak >= 2) {
      return {
        title: `Your ${s.streak}-day streak is at risk`,
        body: `${name}, one Quick Five before bed keeps it alive.`,
        tag: "evening",
        url,
      };
    }
    return {
      title: "Have you practised today?",
      body: pick(
        [
          `${name}, five questions takes about two minutes. Test yourself now.`,
          `A little practice every day beats a long cram. Do today's Quick Five.`,
          `${name}, today isn't over. One round is all it takes.`,
        ],
        now,
      ),
      tag: "evening",
      url,
    };
  }

  if (days !== null && days <= 60 && (days <= 14 || days % 7 === 0)) {
    return {
      title: days === 0 ? "JAMB is today. You've got this" : `JAMB is ${days} ${days === 1 ? "day" : "days"} away`,
      body: s.target
        ? `${name}, your desired score is ${s.target}. Practise today to get closer.`
        : `${name}, a round today keeps you moving toward exam day.`,
      tag: "morning",
      url,
    };
  }

  if (s.target) {
    return {
      title: `Your goal: ${s.target} in JAMB`,
      body: pick(
        [
          `${name}, you can get there by practising. Start today with a Quick Five.`,
          `Every question you practise moves you toward ${s.target}. Test yourself today.`,
          `Good morning, ${name}. Ready for today's round?`,
        ],
        now,
      ),
      tag: "morning",
      url,
    };
  }

  return {
    title: "Good morning! Ready to practise?",
    body: `${name}, start your day with five questions.`,
    tag: "morning",
    url,
  };
}
