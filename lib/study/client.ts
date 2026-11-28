import { HOUR, cached, invalidate } from "@/lib/cache";
import { supabase } from "@/lib/supabase/client";
import type { StudyTime } from "./days";

export function getStudyTimes(): Promise<StudyTime[]> {
  return cached("user:study-times", HOUR, async () => {
    const { data, error } = await supabase().rpc("get_study_times");
    if (error) throw new Error("Couldn't load your study times.");
    return (data as { time: string; days: number[] }[]).map((t) => ({ time: t.time, days: t.days }));
  });
}

export async function saveStudyTimes(times: StudyTime[]): Promise<void> {
  const { error } = await supabase().rpc("set_study_times", { p_times: times });
  if (error) throw new Error("Couldn't save your study times. Check your connection and try again.");
  invalidate("user:study-times");
}