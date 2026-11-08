"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountRequiredError, data } from "@/lib/data";
import type { SessionConfig } from "@/lib/types";

export function useStartSession() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  // Next keeps visited pages alive in the background, so a page revisited later must not
  // come back still "starting". Effect cleanup runs when the page is hidden.
  useEffect(() => () => setStarting(false), []);

  async function start(config: SessionConfig) {
    if (starting) return;
    setStarting(true);
    try {
      const session = await data.startSession(config);
      router.push(`/session/${session.id}`);
    } catch (err) {
      if (err instanceof AccountRequiredError) {
        router.push("/start");
        return;
      }
      toast.error(err instanceof Error ? err.message : "Couldn't start practice. Check your connection and try again.");
      setStarting(false);
    }
  }

  return { start, starting };
}
