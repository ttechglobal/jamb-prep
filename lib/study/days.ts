/** Study days are ISO weekday numbers: 1 is Monday and 7 is Sunday. */
export const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_LETTER = ["M", "T", "W", "T", "F", "S", "S"];

export type Preset = "every" | "weekdays" | "custom";

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Which of the quick choices a set of days is. Anything else is a custom pick. */
export function presetOf(days: number[]): Preset {
  if (same(days, ALL_DAYS)) return "every";
  if (same(days, WEEKDAYS)) return "weekdays";
  return "custom";
}

/** A set of days in words: "Every day", "Weekdays" or "Mon, Wed, Fri". */
export function daysLabel(days: number[]): string {
  const preset = presetOf(days);
  if (preset === "every") return "Every day";
  if (preset === "weekdays") return "Weekdays";
  return [...days].sort((a, b) => a - b).map((d) => DAY_SHORT[d - 1]).join(", ");
}

/** "18:30" as "6:30 pm". */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export const MAX_STUDY_TIMES = 3;

export type StudyTime = { time: string; days: number[] };

/** Why a list of study times cannot be saved yet, or null when it can. */
export function problemWith(times: StudyTime[]): string | null {
  if (times.length > MAX_STUDY_TIMES) return `You can set up to ${MAX_STUDY_TIMES} study times.`;
  const seen = new Set<string>();
  for (const t of times) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) return "Choose a time for each study time.";
    if (seen.has(t.time)) return "Two study times are at the same time.";
    seen.add(t.time);
    if (t.days.length === 0) return `Pick at least one day for ${timeLabel(t.time)}.`;
  }
  return null;
}

/** Quick choices for when in the day. Each is just a starting time the student can still change. */
export const TIME_OF_DAY: { label: string; time: string }[] = [
  { label: "Early morning", time: "06:00" },
  { label: "After school", time: "16:00" },
  { label: "Evening", time: "19:00" },
  { label: "Night", time: "21:00" },
];

/** The study time that comes next from `now`, as words like "Today, 6:00 pm", or null when there are none. */
export function nextStudyLabel(times: StudyTime[], now = new Date()): string | null {
  let best: { at: number; text: string } | null = null;
  for (const t of times) {
    const [h, m] = t.time.split(":").map(Number);
    for (let ahead = 0; ahead < 8; ahead++) {
      const day = new Date(now);
      day.setDate(now.getDate() + ahead);
      day.setHours(h, m, 0, 0);
      const iso = day.getDay() === 0 ? 7 : day.getDay();
      if (day.getTime() <= now.getTime() || !t.days.includes(iso)) continue;
      const when = ahead === 0 ? "Today" : ahead === 1 ? "Tomorrow" : DAY_SHORT[iso - 1];
      if (!best || day.getTime() < best.at) best = { at: day.getTime(), text: `${when}, ${timeLabel(t.time)}` };
      break;
    }
  }
  return best?.text ?? null;
}

/** The next study time as a short call to action: "Study by 6:00 pm", "Study by 7:00 am tomorrow", or null with no times. */
export function studyByLabel(times: StudyTime[], now = new Date()): string | null {
  let best: { at: number; text: string } | null = null;
  for (const t of times) {
    const [h, m] = t.time.split(":").map(Number);
    for (let ahead = 0; ahead < 8; ahead++) {
      const day = new Date(now);
      day.setDate(now.getDate() + ahead);
      day.setHours(h, m, 0, 0);
      const iso = day.getDay() === 0 ? 7 : day.getDay();
      if (day.getTime() <= now.getTime() || !t.days.includes(iso)) continue;
      const when = ahead === 0 ? "" : ahead === 1 ? " tomorrow" : ` on ${DAY_SHORT[iso - 1]}`;
      if (!best || day.getTime() < best.at) best = { at: day.getTime(), text: `Study by ${timeLabel(t.time)}${when}` };
      break;
    }
  }
  return best?.text ?? null;
}
