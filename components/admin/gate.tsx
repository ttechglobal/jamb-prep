import { Suspense } from "react";
import { LoginForm } from "@/components/admin/forms";
import { isAdmin } from "@/lib/admin/auth";

/** Every admin page goes through this. Pages decide what to render only after the password check passes. */
export function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="py-10 text-center text-muted-foreground">Loading…</p>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}

async function Gate({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) return <LoginForm />;
  return children;
}
