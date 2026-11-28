import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PathView } from "@/components/path/path-view";
import { PATH_ENABLED } from "@/lib/path/flag";

export default function PathPage() {
  if (!PATH_ENABLED) notFound();
  return (
    <Suspense>
      <PathView />
    </Suspense>
  );
}
