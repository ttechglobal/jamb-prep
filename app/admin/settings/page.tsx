import { AdminPage } from "@/components/admin/gate";
import { PasswordForm } from "@/components/admin/forms";
import { usingEnvPassword } from "@/lib/admin/auth";

export default function AdminSettingsPage() {
  return (
    <AdminPage>
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <section className="game-card mt-4 p-4">
          <h2 className="mb-3 text-lg font-semibold">Admin password</h2>
          {usingEnvPassword() ? (
            <div className="space-y-2 text-sm">
              <p>
                The password is set in <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code> as <code className="rounded bg-muted px-1.5 py-0.5">ADMIN_PASSWORD</code>.
              </p>
              <p className="text-muted-foreground">To change it, edit that line or run <code className="rounded bg-muted px-1.5 py-0.5">npm run admin:password</code>, then restart the server. Everyone is signed out when it changes.</p>
            </div>
          ) : (
            <>
              <PasswordForm />
              <p className="mt-3 text-xs text-muted-foreground">Changing it signs out every browser that is signed in. To keep the password in .env.local instead, run npm run admin:password.</p>
            </>
          )}
          <p className="mt-3 text-xs text-muted-foreground">You stay signed in for 30 days on each browser.</p>
        </section>
      </div>
    </AdminPage>
  );
}
