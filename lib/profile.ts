import { SUBJECT_TARGET } from "@/lib/exam-format";
import type { Profile } from "@/lib/types";

/** A target for each chosen subject, keeping existing values and defaulting new subjects. */
export function targetsFor(subjectIds: string[], targets: Record<string, number>) {
  return Object.fromEntries(subjectIds.map((id) => [id, targets[id] ?? SUBJECT_TARGET.default]));
}

export function totalTarget(profile: Profile) {
  return profile.subjectIds.reduce((sum, id) => sum + (profile.subjectTargets[id] ?? SUBJECT_TARGET.default), 0);
}
