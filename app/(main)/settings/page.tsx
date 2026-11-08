"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { LevelBar, SubjectIcon } from "@/components/game/game-ui";
import { DeviceSettings } from "@/components/pwa/device-settings";
import { SubjectPicker, isValidSubjectSelection } from "@/components/profile/subject-picker";
import { SubjectTargets } from "@/components/profile/subject-targets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppState } from "@/lib/app-state";
import { SUBJECTS } from "@/lib/catalog";
import { SUBJECT_TARGET, UTME_FORMAT } from "@/lib/exam-format";
import { targetsFor } from "@/lib/profile";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

function Settings() {
  const { account, profile } = useAppState();
  const edit = useSearchParams().get("edit");
  if (!account || !profile) return null;
  return <SettingsForm email={account.email} profile={profile} startWith={edit === "targets" ? "targets" : null} />;
}

type Section = "name" | "subjects" | "targets";

/** Shows each setting as plain text. Tapping Edit opens just that one, so nothing is editable by accident. */
function SettingsForm({ email, profile, startWith }: { email: string; profile: Profile; startWith: Section | null }) {
  const router = useRouter();
  const { progress, saveProfile, signOut } = useAppState();
  const [name, setName] = useState(profile.displayName);
  const [subjects, setSubjects] = useState(profile.subjectIds);
  const [targets, setTargets] = useState(profile.subjectTargets);
  const [open, setOpen] = useState<Record<Section, boolean>>({ name: false, subjects: false, targets: startWith === "targets" });
  const [saving, setSaving] = useState(false);

  // Arriving from the home page's score opens the targets ready to change.
  useEffect(() => {
    if (startWith === "targets") document.getElementById("targets")?.scrollIntoView({ block: "start" });
  }, [startWith]);

  const subjectsValid = isValidSubjectSelection(subjects);
  const valid = name.trim().length >= 2 && subjectsValid;
  const savedTargets = targetsFor(profile.subjectIds, profile.subjectTargets);
  const draftTargets = targetsFor(subjectsValid ? subjects : profile.subjectIds, targets);
  const dirty =
    name.trim() !== profile.displayName ||
    subjects.join() !== profile.subjectIds.join() ||
    JSON.stringify(Object.entries(draftTargets).sort()) !== JSON.stringify(Object.entries(savedTargets).sort());

  function toggle(section: Section) {
    if (open[section]) {
      // Closing without saving puts the saved value back.
      if (section === "name") setName(profile.displayName);
      if (section === "subjects") setSubjects(profile.subjectIds);
      if (section === "targets") setTargets(profile.subjectTargets);
    }
    setOpen((o) => ({ ...o, [section]: !o[section] }));
  }

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await saveProfile({ displayName: name.trim(), subjectIds: subjects, subjectTargets: targetsFor(subjects, targets) });
      setOpen({ name: false, subjects: false, targets: false });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const total = profile.subjectIds.reduce((sum, id) => sum + (savedTargets[id] ?? SUBJECT_TARGET.default), 0);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-3xl font-semibold">Your profile</h1>

      <section aria-label="Your stats" className="game-card p-4">
        <LevelBar xp={progress.xp} />
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t-2 pt-3 text-center">
          {[
            ["Best streak", progress.bestStreak],
            ["Rounds", progress.sessionsCompleted],
            ["Questions", progress.questionsAnswered],
          ].map(([label, value]) => (
            <div key={label}>
              <dd className="font-display text-xl font-semibold">{value}</dd>
              <dt className="text-xs text-muted-foreground">{label}</dt>
            </div>
          ))}
        </dl>
      </section>

      <section className="game-card p-4" aria-labelledby="name-title">
        <SectionHeader id="name-title" title="Display name" editing={open.name} onToggle={() => toggle("name")} />
        {open.name ? (
          <div className="mt-2 space-y-1.5">
            <Label htmlFor="name" className="sr-only">
              Display name
            </Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={30} autoFocus className="h-12 text-base" />
          </div>
        ) : (
          <p className="mt-1 break-words font-medium">{profile.displayName}</p>
        )}
      </section>

      <section className="game-card p-4" aria-labelledby="subjects-title">
        <SectionHeader id="subjects-title" title="Subjects" editing={open.subjects} onToggle={() => toggle("subjects")} />
        {open.subjects ? (
          <div className="mt-2">
            <SubjectPicker value={subjects} onChange={setSubjects} />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {profile.subjectIds.map((id) => (
              <li key={id} className="flex items-center gap-3">
                <SubjectIcon id={id} className="size-9" />
                <span className="min-w-0 font-medium leading-tight">{SUBJECTS.find((s) => s.id === id)?.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="targets" className="game-card scroll-mt-20 p-4" aria-labelledby="targets-title">
        <SectionHeader id="targets-title" title="Desired JAMB score" editing={open.targets} onToggle={() => toggle("targets")} />
        {open.targets ? (
          <div className="mt-2">
            <p className="mb-3 text-sm text-muted-foreground">Your goals, not a prediction.</p>
            <SubjectTargets subjectIds={subjectsValid ? subjects : profile.subjectIds} value={targets} onChange={setTargets} />
          </div>
        ) : (
          <>
            <p className="mt-1 font-display text-3xl font-semibold text-primary">
              {total}
              <span className="text-base font-medium text-muted-foreground"> / {UTME_FORMAT.maxTotal}</span>
            </p>
            <ul className="mt-2 divide-y-2">
              {profile.subjectIds.map((id) => (
                <li key={id} className="flex items-center gap-3 py-2">
                  <SubjectIcon id={id} className="size-9" />
                  <span className="min-w-0 flex-1 font-medium leading-tight">{SUBJECTS.find((s) => s.id === id)?.name}</span>
                  <span className="shrink-0 font-display text-lg font-semibold">{savedTargets[id]}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <DeviceSettings />

      <section className="game-card flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="truncate text-sm font-semibold">{email}</p>
        </div>
        <Button
          variant="outline"
          size="lg"
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
        >
          Sign out
        </Button>
      </section>

      {dirty ? (
        <div className="sticky bottom-0 z-10 -mx-4 border-t-2 bg-background px-4 pb-4 pt-3">
          <Button size="xl" className="w-full" disabled={!valid || saving} onClick={save}>
            Save changes
          </Button>
          {!valid ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {name.trim().length < 2 ? "Enter a name of at least 2 letters." : "Choose three subjects besides Use of English."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({ id, title, editing, onToggle }: { id: string; title: string; editing: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <h2 id={id} className="min-w-0 flex-1 text-lg font-semibold">
        {title}
      </h2>
      <button
        type="button"
        onClick={onToggle}
        aria-label={`${editing ? "Cancel editing" : "Edit"} ${title}`}
        className={cn(
          "-mr-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition-colors hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          editing ? "text-muted-foreground" : "text-primary",
        )}
      >
        {editing ? (
          "Cancel"
        ) : (
          <>
            <Pencil className="size-4" aria-hidden /> Edit
          </>
        )}
      </button>
    </div>
  );
}
