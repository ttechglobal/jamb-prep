import { AdminPage } from "@/components/admin/gate";
import { MYQUEST_SUBJECTS } from "@/lib/myquest/subjects";
import { loadCatalogue } from "./actions";
import { ImportFlow } from "./import-flow";

export default function ImportPage() {
  return (
    <AdminPage>
      <ImportData />
    </AdminPage>
  );
}

async function ImportData() {
  const exams = await loadCatalogue("exam", {});
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold">Import questions</h1>
        <p className="mt-1 text-muted-foreground">
          Fetch one MyQuest paper, check that it adds up, and see what would be imported before anything touches the question bank. This page does not publish yet.
        </p>
      </div>
      <ImportFlow exams={exams.ok ? exams.options : []} loadError={exams.ok ? null : exams.error} mapped={Object.keys(MYQUEST_SUBJECTS)} />
    </div>
  );
}
