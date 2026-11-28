import { MINUTE, cached } from "@/lib/cache";
import { data } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { getReadCatalogue } from "./client";
import { matchTopic } from "./match";

export type UnitLesson = { id: string; title: string };

/**
 * Which notes belong to which step on a subject's path. Each note is matched to a JAMB topic by name, and the topic
 * says which step it sits in. A note that matches no topic is tried against the step names. Nothing is listed by hand:
 * publish a note in EXL and it turns up on the right step.
 */
export function loadUnitReading(subjectId: string, units: { id: string; name: string }[]): Promise<Map<string, UnitLesson[]>> {
  return cached(`read:units:${subjectId}`, 10 * MINUTE, async () => {
    const [catalogue, topics, links] = await Promise.all([
      getReadCatalogue(),
      data.listTopics(subjectId),
      supabase().from("path_unit_topics").select("unit_id, topic_id, path_units!inner(subject_id)").eq("path_units.subject_id", subjectId),
    ]);
    const unitOfTopic = new Map<string, string>((links.data ?? []).map((r) => [r.topic_id as string, r.unit_id as string]));
    const unitsAsTopics = units.map((u) => ({ id: u.id, subjectId, name: u.name }));

    const out = new Map<string, UnitLesson[]>();
    for (const subject of catalogue.subjects.filter((s) => s.subjectId === subjectId)) {
      for (const topic of subject.topics) {
        for (const lesson of topic.lessons) {
          const titles = [lesson.topicTitle, topic.title, lesson.title];
          const byTopic = matchTopic(topics, titles);
          const unitId = (byTopic && unitOfTopic.get(byTopic.id)) ?? matchTopic(unitsAsTopics, titles)?.id;
          if (!unitId) continue;
          out.set(unitId, [...(out.get(unitId) ?? []), { id: lesson.id, title: lesson.title }]);
        }
      }
    }
    return out;
  });
}
