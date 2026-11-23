import { ArrowLeft, BookOpenText, Sigma } from "lucide-react";
import Link from "next/link";

const WORLDS = [
  { href: "/games/english", name: "English World", line: "Grammar, vocabulary, sounds and idioms, learnt by playing.", Icon: BookOpenText, tint: "bg-sky-soft text-sky" },
  { href: "/games/maths", name: "Maths World", line: "Finish the working. The solution stops, and you take the next step.", Icon: Sigma, tint: "bg-violet-soft text-violet" },
];

export default function GamesPage() {
  const card = "game-card game-tap flex items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/practice" className="mb-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-5" aria-hidden />
        Back to practice
      </Link>
      <header className="mb-5">
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">Games</h1>
        <p className="mt-0.5 text-muted-foreground">Pick a world.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {WORLDS.map(({ href, name, line, Icon, tint }) => (
          <li key={href}>
            <Link href={href} className={card}>
              <span aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-2xl ${tint}`}>
                <Icon className="size-7" strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-xl font-semibold leading-tight">{name}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{line}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
