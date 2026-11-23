import { adminDb, isAdmin } from "@/lib/admin/auth";
import { loadPaperWith, publishedRefsWith, type Loaded } from "@/lib/myquest/enrich/server";
import type { PaperInput } from "./types";

export type { Loaded };

/** Everything about one fetched paper, rebuilt the same way every time so batch ids stay stable. */
export async function loadPaper(input: PaperInput): Promise<{ ok: true; data: Loaded } | { ok: false; error: string }> {
  if (!(await isAdmin())) return { ok: false, error: "Sign in again." };
  return loadPaperWith(adminDb(), input);
}

/** source_ref to the publish that made it live, for this paper. */
export async function publishedRefs(paperId: string): Promise<Map<string, string>> {
  return publishedRefsWith(adminDb(), paperId);
}
