"use client";

import { useActionState, useState } from "react";
import { sendNow, type FormState } from "@/app/admin/actions";
import { NotificationPreview, sample } from "@/components/admin/notification-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Student {
  user_id: string;
  name: string;
  practisedToday: boolean;
}

const PRESETS = [
  { label: "Practise today", title: "Have you practised today?", body: "{name}, five questions takes about two minutes. Test yourself now." },
  { label: "New game", title: "A new game is waiting", body: "{name}, try the Games tab and practise by playing." },
  { label: "Mock exam", title: "Ready for a full mock?", body: "Sit a full UTME CBT mock today and see where you stand." },
];

const AUDIENCES = [
  { value: "all", label: "Everyone with reminders on" },
  { value: "not_practised", label: "Only those who haven't practised today" },
  { value: "one", label: "One student" },
];

export function SendNowForm({ students, devices }: { students: Student[]; devices: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendNow, {});
  const [audience, setAudience] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const waiting = students.filter((s) => !s.practisedToday).length;
  const reach = audience === "all" ? `${students.length} students` : audience === "not_practised" ? `${waiting} students` : "1 student";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Send this to ${reach} now? It can't be taken back.`)) e.preventDefault();
      }}
      className="space-y-4"
    >
      <div>
        <p className="text-sm font-medium">Start from</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setTitle(p.title);
                setBody(p.body);
              }}
              className="inline-flex h-11 items-center rounded-xl border-2 px-3 text-sm font-semibold hover:bg-muted"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="audience">Who gets it</Label>
            <select
              id="audience"
              name="audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="h-11 w-full rounded-xl border-2 bg-card px-3 text-base"
            >
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {audience === "one" ? (
            <div className="space-y-1.5">
              <Label htmlFor="student">Student</Label>
              <select id="student" name="student" required defaultValue="" className="h-11 w-full rounded-xl border-2 bg-card px-3 text-base">
                <option value="" disabled>
                  Choose a student
                </option>
                {students.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.name}
                    {s.practisedToday ? " (practised today)" : ""}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} required className="h-11 text-base" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Input id="body" name="body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={160} required className="h-11 text-base" />
            <p className="text-xs text-muted-foreground">
              {"{name}"} becomes the student&apos;s first name. {body.length}/160
            </p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium">What they will see</p>
          <div className="mt-1.5">
            <NotificationPreview title={sample(title)} body={sample(body)} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {devices} {devices === 1 ? "device has" : "devices have"} reminders on. This goes to {reach}.
          </p>
        </div>
      </div>

      {state.error ? <p role="alert" className="text-sm font-medium text-destructive">{state.error}</p> : null}
      {state.ok ? <p role="status" className="text-sm font-medium text-success">{state.ok}</p> : null}
      <Button type="submit" size="lg" disabled={pending || devices === 0}>
        {pending ? "Sending…" : "Send now"}
      </Button>
    </form>
  );
}
