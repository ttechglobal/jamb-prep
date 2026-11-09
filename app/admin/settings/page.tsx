import { AdminPage } from "@/components/admin/gate";
import { PasswordForm } from "@/components/admin/forms";

export default function AdminSettingsPage() {
  return (
    <AdminPage>
      <div className="max-w-sm">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <section className="game-card mt-4 p-4">
          <h2 className="mb-3 text-lg font-semibold">Admin password</h2>
          <PasswordForm />
          <p className="mt-3 text-xs text-muted-foreground">Changing it signs out every browser that is signed in.</p>
        </section>
      </div>
    </AdminPage>
  );
}
