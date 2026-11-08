"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubjectPicker, isValidSubjectSelection } from "@/components/profile/subject-picker";
import { SubjectTargets } from "@/components/profile/subject-targets";
import { useAppState } from "@/lib/app-state";
import { UTME_FORMAT } from "@/lib/exam-format";
import { targetsFor } from "@/lib/profile";
import { cn } from "@/lib/utils";

const STEPS = [
  { title: "What should we call you?", sub: "You can change this any time." },
  { title: "Choose your UTME subjects", sub: "Use of English is compulsory. Pick three more." },
  { title: "Set your target scores", sub: "One for each subject. These are your goals, not a prediction." },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { hydrated, account, profile, progress, saveProfile } = useAppState();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.displayName ?? "");
  // Subjects tried as a guest are already chosen, so a returning student has less to tap.
  const [subjects, setSubjects] = useState<string[]>(
    () =>
      profile?.subjectIds ?? [
        UTME_FORMAT.compulsorySubjectSlug,
        ...Object.keys(progress.subjects)
          .filter((id) => id !== UTME_FORMAT.compulsorySubjectSlug)
          .slice(0, UTME_FORMAT.subjectCount - 1),
      ],
  );
  const [targets, setTargets] = useState<Record<string, number>>(profile?.subjectTargets ?? {});

  useEffect(() => {
    if (hydrated && !account) router.replace("/register");
  }, [account, hydrated, router]);

  const canContinue = step === 0 ? name.trim().length >= 2 : step === 1 ? isValidSubjectSelection(subjects) : true;
  const last = step === STEPS.length - 1;

  async function next() {
    if (!canContinue) return;
    if (!last) return setStep(step + 1);
    try {
      await saveProfile({ displayName: name.trim(), subjectIds: subjects, subjectTargets: targetsFor(subjects, targets) });
      router.push("/practice");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save. Try again.");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-14 w-full max-w-xl items-center px-4">
        <Logo />
        <span className="ml-auto text-sm font-medium text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </header>
      <div className="mx-auto w-full max-w-xl px-4">
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
          aria-label="Onboarding progress"
        >
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn("h-3 flex-1 rounded-full transition-colors", i <= step ? "bg-brand-bright" : "bg-muted")} />
          ))}
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-6 pt-6">
        <h1 className="text-3xl font-semibold leading-tight">{STEPS[step].title}</h1>
        <p className="mt-1 text-muted-foreground">{STEPS[step].sub}</p>

        <form
          className="mt-6 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            next();
          }}
        >
          <div className="flex-1">
            {step === 0 ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={30}
                  autoComplete="nickname"
                  autoFocus
                  placeholder="e.g. Tolu"
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">A first name or nickname is enough.</p>
              </div>
            ) : step === 1 ? (
              <SubjectPicker value={subjects} onChange={setSubjects} />
            ) : (
              <SubjectTargets subjectIds={subjects} value={targets} onChange={setTargets} />
            )}
          </div>

          <div className="sticky bottom-0 mt-8 flex gap-3 bg-background pb-2 pt-3">
            {step > 0 ? (
              <Button type="button" variant="outline" size="xl" onClick={() => setStep(step - 1)} aria-label="Back">
                <ArrowLeft aria-hidden />
              </Button>
            ) : null}
            <Button type="submit" size="xl" className="flex-1" disabled={!canContinue}>
              {last ? "Start practising" : "Continue"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
