"use client";

import { Download } from "lucide-react";
import { usePwa } from "@/components/pwa/pwa-provider";
import { Button } from "@/components/ui/button";

/** Rendered only when the browser says the app is installable. */
export function InstallButton({ className }: { className?: string }) {
  const { canInstall, install } = usePwa();
  if (!canInstall) return null;
  return (
    <Button variant="ghost" size="lg" className={className} onClick={install}>
      <Download aria-hidden />
      Install app
    </Button>
  );
}
