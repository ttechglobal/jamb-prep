import Image from "next/image";

/** What a phone notification looks like, so the admin can judge wording and length before sending. */
export function NotificationPreview({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border-2 bg-card p-3">
      <Image src="/icons/icon-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
      <div className="min-w-0">
        <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">JAMB Prep · now</p>
        <p className="truncate text-sm font-semibold leading-snug">{title || "Title"}</p>
        <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{body || "Your message appears here."}</p>
      </div>
    </div>
  );
}

/** Fills the {placeholders} with an example student, for previews of saved messages. */
export function sample(text: string) {
  return text.replaceAll("{name}", "Ada").replaceAll("{target}", "350").replaceAll("{streak}", "5").replaceAll("{days}", "30");
}
