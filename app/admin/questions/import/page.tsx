import { AdminPage } from "@/components/admin/gate";
import { adminDb } from "@/lib/admin/auth";
import { MYQUEST_SUBJECTS } from "@/lib/myquest/subjects";
import { ImportFlow } from "./import-flow";

export default function ImportPage() {
  return (
    <AdminPage>
      <ImportData />
    </AdminPage>
  );
}

async function ImportData() {
  // Our own subject list, not MyQuest's. Only subjects MyQuest can supply are offered.
  const { data } = await adminDb().from("subjects").select("id, name, sort_order").in("id", Object.values(MYQUEST_SUBJECTS)).order("sort_order");
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Import questions</h1>
        <p className="mt-1 text-muted-foreground">
          Choose a subject to see the years with no questions yet. Fetch one paper, check that it adds up, and see what would be imported before anything touches the question bank. This page does not publish yet.
        </p>
      </div>
      <ImportFlow subjects={(data ?? []).map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
