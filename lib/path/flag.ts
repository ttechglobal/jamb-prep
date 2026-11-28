/**
 * The study path is on for everyone. It used to ship dark and only showed when NEXT_PUBLIC_PATH was "on", which
 * is set on a developer machine but is easy to miss on the host, so the live app lost its path. It is now off only
 * if NEXT_PUBLIC_PATH is set to "off" at build time. Partners stay hidden until NEXT_PUBLIC_PARTNERS="on".
 */
export const PATH_ENABLED = process.env.NEXT_PUBLIC_PATH !== "off";
export const PARTNERS_VISIBLE = process.env.NEXT_PUBLIC_PARTNERS === "on";
