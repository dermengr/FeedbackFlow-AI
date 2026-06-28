import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listViews } from "@/lib/views";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { SavedViewsManager } from "@/components/SavedViewsManager";

export const dynamic = "force-dynamic";

export default async function SavedViewsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const views = await listViews(session.user.id);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Saved Views"
        description="Manage your saved inbox views and quickly apply them."
      />

      <PageSection>
        <SavedViewsManager initialViews={views} />
      </PageSection>
    </PageShell>
  );
}
