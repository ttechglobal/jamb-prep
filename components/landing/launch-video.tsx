"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { track } from "@/lib/analytics";

/**
 * The launch film. It is a tall phone-shaped video, so it shows as a poster with a play button and
 * downloads only when tapped, which keeps the page light for students on mobile data.
 */
export function LaunchVideo({ className }: { className?: string }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className={className}>
      <div className="game-card relative mx-auto aspect-[9/16] w-full max-w-[17rem] overflow-hidden bg-brand-deep p-0">
        {playing ? (
          <video
            className="size-full object-cover"
            src="/video/launch.mp4"
            poster="/video/launch-poster.jpg"
            controls
            autoPlay
            playsInline
            preload="auto"
          >
            Your browser cannot play this video.
          </video>
        ) : (
          <button
            type="button"
            onClick={() => {
              void track("landing_card_click", { mode: "video" });
              setPlaying(true);
            }}
            aria-label="Play the 30 second video"
            className="group relative block size-full focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {/* A plain img: the poster is a small fixed file and has to paint before any script runs. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/video/launch-poster.jpg" alt="" className="size-full object-cover" loading="lazy" />
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid size-18 place-items-center rounded-full border-b-[5px] border-gold-edge bg-gold text-gold-ink transition group-hover:brightness-105 group-active:translate-y-0.5">
                <Play className="ml-1 size-8 fill-current" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
