import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JAMB Prep",
    short_name: "JAMB Prep",
    description: "Free JAMB UTME practice: Quick Five, subject practice, timed drills and full CBT mock exams.",
    id: "/",
    start_url: "/practice",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6F8F5",
    theme_color: "#14532D",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
