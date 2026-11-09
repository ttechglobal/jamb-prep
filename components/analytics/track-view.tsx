"use client";

import { useEffect } from "react";
import { trackOnce, type EventName } from "@/lib/analytics";

/** Records that a page was seen, once per visit. Renders nothing. */
export function TrackView({ name }: { name: EventName }) {
  useEffect(() => {
    trackOnce(name);
  }, [name]);
  return null;
}
