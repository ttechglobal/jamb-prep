import { supabase } from "@/lib/supabase/client";
import type { PathData, PathMode, PathOrder, PathOverview } from "./types";

/** One subject's trail for the signed-in student. Empty `units` means the subject has no path yet. */
export async function getPath(subjectId: string): Promise<PathData> {
  const { data, error } = await supabase().rpc("get_path", { p_subject: subjectId });
  if (error) throw new Error("Couldn't load your path. Check your connection and try again.");
  return data as PathData;
}

/** One line per subject that has a path, for the Home card. */
export async function getPathOverview(): Promise<PathOverview> {
  const { data, error } = await supabase().rpc("get_path_overview");
  if (error) throw new Error("Couldn't load your path.");
  return data as PathOverview;
}

/** Saves how the student wants to start and in what order. Pass null to leave one unchanged. */
export async function setPathPrefs(mode: PathMode | null, order: PathOrder | null): Promise<void> {
  const { error } = await supabase().rpc("set_path_prefs", { p_mode: mode, p_order: order });
  if (error) throw new Error("Couldn't save that. Try again.");
}
