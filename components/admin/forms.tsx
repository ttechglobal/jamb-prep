"use client";

import { useActionState } from "react";
import { changePassword, deleteTemplate, login, saveTemplate, setExamDate, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const none: FormState = {};

function Feedback({ state }: { state: FormState }) {
  if (state.error) return <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm font-medium text-success">{state.ok}</p>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, none);
  return (
    <form action={action} className="game-card mx-auto mt-16 w-full max-w-sm space-y-3 p-5">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" autoFocus required className="h-12 text-base" />
      </div>
      <Feedback state={state} />
      <Button type="submit" size="xl" className="w-full" disabled={pending}>
        Sign in
      </Button>
    </form>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, none);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="next">New password</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="h-12 text-base" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirm">Type it again</Label>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required className="h-12 text-base" />
      </div>
      <Feedback state={state} />
      <Button type="submit" size="lg" disabled={pending}>
        Change password
      </Button>
    </form>
  );
}

export function ExamDateForm({ date }: { date: string | null }) {
  const [state, action, pending] = useActionState(setExamDate, none);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="date">JAMB exam date</Label>
        <Input id="date" name="date" type="date" defaultValue={date ?? ""} className="h-11 text-base" />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        Save
      </Button>
      <div className="basis-full">
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function TemplateForm({
  kind,
  template,
}: {
  kind: string;
  template?: { id: string; title: string; body: string; active: boolean };
}) {
  const [state, action, pending] = useActionState(saveTemplate, none);
  return (
    <div className="rounded-xl border-2 p-3">
      <form action={action} className="space-y-2">
        <input type="hidden" name="kind" value={kind} />
        {template ? <input type="hidden" name="id" value={template.id} /> : null}
        <Input name="title" defaultValue={template?.title ?? ""} placeholder="Title" maxLength={60} required aria-label="Notification title" className="h-11 font-semibold" />
        <Input name="body" defaultValue={template?.body ?? ""} placeholder="Message" maxLength={160} required aria-label="Notification message" className="h-11" />
        <div className="flex flex-wrap items-center gap-3">
          {template ? (
            <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="active" defaultChecked={template.active} className="size-5" />
              In use
            </label>
          ) : null}
          <Button type="submit" size="lg" variant={template ? "outline" : "default"} disabled={pending}>
            {template ? "Save" : "Add message"}
          </Button>
          <Feedback state={state} />
        </div>
      </form>
      {template ? (
        <form action={deleteTemplate} className="mt-1">
          <input type="hidden" name="id" value={template.id} />
          <button type="submit" className="min-h-11 text-sm font-semibold text-destructive hover:underline">
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}
