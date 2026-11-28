import { redirect } from "next/navigation";

/** Progress now lives on the profile page. This keeps old links and bookmarks working. */
export default function ProgressPage() {
  redirect("/settings");
}
