"use client";

import { Loader2, RefreshCw, Trophy, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { trackOnce } from "@/lib/analytics";
import { MINUTE, cached } from "@/lib/cache";
import { useAppState } from "@/lib/app-state";
import { levelFor } from "@/lib/game/rules";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Period = "week" | "month" | "all";
const TABS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All time" },
];

interface Row {
  rank: number;
  name: string;
  xp: number;
  me: boolean;
}
interface Board {
  rows: Row[];
  meRank: number | null;
  meXp: number | null;
}

const MEDAL: Record<number, string> = {
  1: "bg-gold text-gold-ink",
  2: "bg-muted text-foreground",
  3: "bg-flame-soft text-flame",
};

function parse(raw: unknown): Board {
  const r = (raw ?? {}) as { rows?: Row[]; me?: { rank?: number; xp?: number } | null };
  return {
    rows: Array.isArray(r.rows) ? r.rows : [],
    meRank: r.me?.rank ?? null,
    meXp: r.me?.xp ?? null,
  };
}

export default function LeaderboardPage() {
  const { account } = useAppState();
  const [period, setPeriod] = useState<Period>("week");
  const [boards, setBoards] = useState<Partial<Record<Period, Board>>>({});
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setFailed(false);
    try {
      const data = await cached(`user:leaderboard:${p}`, MINUTE, async () => {
        const { data, error } = await supabase().rpc("get_leaderboard", { p_period: p });
        if (error) throw error;
        return data;
      });
      setBoards((b) => ({ ...b, [p]: parse(data) }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    trackOnce("leaderboard_view");
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(period);
  }, [load, period]);

  const board = boards[period];
  const showMine = board && board.meRank !== null && !board.rows.some((r) => r.me);

  return (
    <div className="mx-auto max-w-xl">
      <header className="mb-4 flex items-center gap-3">
        <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold text-gold-ink">
          <Trophy className="size-6" strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold leading-tight">Leaderboard</h1>
          <p className="text-muted-foreground">Top students by XP.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(period)}
          disabled={loading}
          aria-label="Refresh leaderboard"
          className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-5", loading && "animate-spin")} aria-hidden />
        </button>
      </header>

      <div role="tablist" aria-label="Period" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={period === t.id}
            onClick={() => setPeriod(t.id)}
            className={cn(
              "h-10 flex-1 rounded-xl border-2 px-2 font-display text-sm font-semibold transition-colors",
              period === t.id ? "border-primary bg-secondary text-secondary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!board && loading ? (
        <div className="grid place-items-center py-16 text-muted-foreground" aria-busy="true">
          <Loader2 className="size-7 animate-spin" aria-hidden />
        </div>
      ) : failed && !board ? (
        <div className="game-card p-6 text-center">
          <p className="font-display text-xl font-semibold">The board did not load</p>
          <p className="mt-1 text-muted-foreground">Check your connection and try again.</p>
          <button type="button" onClick={() => void load(period)} className={buttonVariants({ size: "lg", className: "mt-4" })}>
            Try again
          </button>
        </div>
      ) : board && board.rows.length === 0 ? (
        <div className="game-card p-6 text-center">
          <p className="font-display text-xl font-semibold">No scores yet</p>
          <p className="mt-1 text-muted-foreground">Nobody has scored in this period. Be the first!</p>
          <Link href="/practice" className={buttonVariants({ size: "lg", className: "mt-4" })}>
            Start practising
          </Link>
        </div>
      ) : board ? (
        <>
          <ol className="game-card overflow-hidden">
            {board.rows.map((r, i) => (
              <RowItem key={`${r.rank}-${i}`} row={r} first={i === 0} showRank={period === "all"} />
            ))}
          </ol>
          {showMine ? (
            <ol className="game-card mt-3 overflow-hidden">
              <RowItem row={{ rank: board.meRank!, name: "You", xp: board.meXp ?? 0, me: true }} first showRank={period === "all"} />
            </ol>
          ) : null}
          {period === "week" ? <p className="mt-2 text-xs text-muted-foreground">Resets every Monday.</p> : null}
        </>
      ) : null}

      {!account ? (
        <div className="game-card mt-4 p-4">
          <p className="font-display text-lg font-semibold">Want your name here?</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Create a free account and your XP counts toward the board.</p>
          <Link href="/register" className={buttonVariants({ size: "lg", className: "mt-3 w-full" })}>
            Create account
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function RowItem({ row, first, showRank }: { row: Row; first: boolean; showRank?: boolean }) {
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5", !first && "border-t border-border", row.me && "bg-secondary")}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-semibold",
          MEDAL[row.rank] ?? "bg-muted text-foreground",
        )}
      >
        {row.rank}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {row.name}
        {row.me && row.name !== "You" ? <span className="ml-1.5 text-xs font-semibold text-primary">(you)</span> : null}
        {showRank ? (
          <span className="block text-xs font-medium text-muted-foreground">
            Level {levelFor(row.xp).level} · {levelFor(row.xp).title}
          </span>
        ) : null}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold-soft px-2.5 py-0.5 font-display text-sm font-semibold text-gold-ink">
        <Zap className="size-3.5 fill-gold text-gold-edge" aria-hidden />
        {row.xp.toLocaleString("en-NG")}
      </span>
    </li>
  );
}
