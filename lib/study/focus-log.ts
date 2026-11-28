/** Seconds of focused study per day, kept on the device. Keys are the student's own calendar days (YYYY-MM-DD). */
const KEY = "jp:study-log:v1";

export type FocusLog = Record<string, number>;

export function dayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function readLog(): FocusLog {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as FocusLog;
  } catch {
    return {};
  }
}

/** Adds seconds of focus to today and returns the updated log. */
export function addFocus(seconds: number): FocusLog {
  const log = readLog();
  if (seconds > 0) log[dayKey()] = (log[dayKey()] ?? 0) + Math.round(seconds);
  try {
    // Keep about four months.
    const keys = Object.keys(log).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - 120))) delete log[k];
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Storage full or blocked: the day's total just will not grow.
  }
  return log;
}

/** The last `n` days ending today, oldest first. */
export function lastDays(log: FocusLog, n: number) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return {
      key: dayKey(d),
      label: d.toLocaleDateString("en-GB", { weekday: "short" }).slice(0, 2),
      seconds: log[dayKey(d)] ?? 0,
      today: i === n - 1,
    };
  });
}

/** Days in a row with some focus, counting back from today (or from yesterday if today has none yet). */
export function focusStreak(log: FocusLog): number {
  const d = new Date();
  if (!(log[dayKey(d)] > 0)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (log[dayKey(d)] > 0) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function formatMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
}
