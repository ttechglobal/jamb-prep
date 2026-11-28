import { HOUR, MINUTE, cached, clearUserCache } from "@/lib/cache";
import { supabase } from "@/lib/supabase/client";
import type { ReadCatalogue, ReadLesson } from "./types";

export function getReadCatalogue(): Promise<ReadCatalogue> {
  return cached("read:catalogue", 5 * MINUTE, async () => {
    const res = await fetch("/api/read/catalogue");
    if (!res.ok) throw new Error("Couldn't load the notes. Check your connection and try again.");
    return res.json();
  }, { persist: true });
}

/** Null when the lesson is gone (unpublished) rather than an error. */
export function getReadLesson(id: string): Promise<ReadLesson | null> {
  return cached(`read:lesson:${id}`, HOUR, async () => {
    const res = await fetch(`/api/read/lesson/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Couldn't load this lesson. Check your connection and try again.");
    return res.json();
  }, { persist: true });
}

/** Warms the browser's own cache for a lesson the student is about to open (hover, focus, touch). Never throws. */
export function prefetchLesson(id: string, format: "embed" | "notes") {
  if (typeof navigator !== "undefined" && "connection" in navigator && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return;
  getReadLesson(id).catch(() => {});
  if (format === "embed") fetch(`/api/read/embed/${encodeURIComponent(id)}`, { priority: "low" } as RequestInit).catch(() => {});
}

/** Tells the server the student finished a lesson. Returns the XP added (0 when they had finished it before), or null on a failure. */
export async function awardRead(lessonId: string): Promise<{ awarded: number; xp: number } | null> {
  try {
    const { data } = await supabase().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/read/complete", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ lessonId }),
    });
    if (!res.ok) return null;
    clearUserCache();
    return res.json();
  } catch {
    return null;
  }
}
