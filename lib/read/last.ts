/** The lesson a student opened last, so Read can offer to pick up where they left off. Kept on the device. */
const KEY = "jp:read:last:v1";

export type LastRead = { id: string; title: string; topic: string; subjectSlug: string };

export function getLastRead(): LastRead | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as LastRead | null;
    return v?.id && v.title ? v : null;
  } catch {
    return null;
  }
}

export function setLastRead(v: LastRead) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}
