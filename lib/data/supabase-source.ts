import { emptyProgress } from "@/lib/game/rules";
import { currentSession, ensureSession, supabase } from "@/lib/supabase/client";
import type { PlayerProgress, PracticeSession, Profile, QuestionReveal, SessionResult, SessionReward, Topic } from "@/lib/types";
import { AccountRequiredError, SessionClosedError, type DataSource } from "./source";

const MESSAGES: Record<string, string> = {
  rate_limited: "You're starting rounds very quickly. Wait a minute and try again.",
  no_questions: "No questions are available for this selection yet.",
  insufficient_questions: "There aren't enough questions for this selection yet. Try fewer questions.",
  onboarding_required: "Finish setting up your subjects first.",
  invalid_name: "Your name should be 2 to 30 characters.",
  invalid_subjects: "Choose Use of English and three other subjects.",
  invalid_target: "Each target must be between 0 and 100.",
};

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);
  if (!error) return data as T;
  if (error.message === "account_required") throw new AccountRequiredError();
  if (error.message === "session_closed") throw new SessionClosedError();
  throw new Error(MESSAGES[error.message] ?? "Something went wrong. Check your connection and try again.");
}

function withoutNull(result: SessionResult | null) {
  if (!result) return null;
  return { ...result, utmeScore: result.utmeScore ?? undefined };
}

export const supabaseSource: DataSource = {
  async listTopics(subjectId) {
    const { data, error } = await supabase()
      .from("topics")
      .select("id, subject_id, name")
      .eq("subject_id", subjectId)
      .eq("active", true)
      .order("sort_order")
      .order("name");
    if (error) throw new Error("Couldn't load topics. Check your connection and try again.");
    return data.map((t): Topic => ({ id: t.id, subjectId: t.subject_id, name: t.name }));
  },

  countQuestions: (subjectId, topicId) => rpc<number>("count_questions", { p_subject_id: subjectId, p_topic_id: topicId ?? null }),

  async startSession(config) {
    await ensureSession();
    return rpc<PracticeSession>("start_session", { p_config: config });
  },

  async getSession(id) {
    if (!(await currentSession())) return null;
    return rpc<PracticeSession | null>("get_session", { p_session_id: id });
  },

  saveAnswer: (sessionId, questionId, option) =>
    rpc<{ reveal?: QuestionReveal }>("save_answer", { p_session_id: sessionId, p_question_id: questionId, p_option: option }),

  async submitSession(id) {
    const result = await rpc<SessionResult>("submit_session", { p_session_id: id });
    return withoutNull(result)!;
  },

  async getResult(id) {
    if (!(await currentSession())) return null;
    return withoutNull(await rpc<SessionResult | null>("get_results", { p_session_id: id }));
  },

  async guestRoundsUsed() {
    const session = await currentSession();
    if (!session?.user.is_anonymous) return 0;
    const { count, error } = await supabase().from("practice_sessions").select("id", { count: "exact", head: true });
    if (error) throw new Error("Couldn't load your rounds.");
    return count ?? 0;
  },

  async getProgress() {
    const session = await currentSession();
    if (!session) return emptyProgress();
    const { data, error } = await supabase().from("player_progress").select("*").eq("user_id", session.user.id).maybeSingle();
    if (error) throw new Error("Couldn't load your progress.");
    if (!data) return emptyProgress();
    return {
      xp: data.xp,
      currentStreak: data.current_streak,
      bestStreak: data.best_streak,
      lastPracticeDay: data.last_practice_day,
      dayQuestions: data.day_questions,
      sessionsCompleted: data.sessions_completed,
      questionsAnswered: data.questions_answered,
      subjects: data.subjects,
    } satisfies PlayerProgress;
  },

  /** The server awards XP when the session closes, so this only reads what was earned. */
  async recordResult(result) {
    const progress = await this.getProgress();
    return { progress, reward: result.reward as SessionReward };
  },

  async getProfile() {
    const session = await currentSession();
    if (!session) return null;
    const [profile, subjects] = await Promise.all([
      supabase().from("profiles").select("display_name, onboarded_at").eq("id", session.user.id).maybeSingle(),
      supabase().from("student_subjects").select("subject_id, target_score").eq("user_id", session.user.id),
    ]);
    if (profile.error || subjects.error) throw new Error("Couldn't load your profile.");
    if (!profile.data?.onboarded_at) return null;
    return {
      displayName: profile.data.display_name,
      subjectIds: subjects.data.map((s) => s.subject_id),
      subjectTargets: Object.fromEntries(subjects.data.map((s) => [s.subject_id, s.target_score])),
    } satisfies Profile;
  },

  async saveProfile(profile) {
    await rpc("complete_onboarding", { p_display_name: profile.displayName, p_subject_targets: profile.subjectTargets });
  },

  async reportQuestion(questionId) {
    const session = await currentSession();
    if (!session) return;
    const { error } = await supabase()
      .from("question_reports")
      .insert({ question_id: questionId, user_id: session.user.id, reason: "reported_by_student" });
    if (error) throw new Error("Couldn't send your report. Check your connection and try again.");
  },
};
