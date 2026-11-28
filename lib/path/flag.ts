/**
 * The path ships dark: nothing about it shows until NEXT_PUBLIC_PATH is "on". Partners stay hidden
 * for now and come back with NEXT_PUBLIC_PARTNERS="on". Both are read at build time.
 */
export const PATH_ENABLED = process.env.NEXT_PUBLIC_PATH === "on";
export const PARTNERS_VISIBLE = process.env.NEXT_PUBLIC_PARTNERS === "on";
