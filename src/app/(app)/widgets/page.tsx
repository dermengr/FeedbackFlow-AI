import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { WidgetGrid } from "@/components/WidgetGrid";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function WidgetsManagementPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Widget Management"
        description="Create, delete, and reorder your dashboard widgets."
      />

      <PageSection>
        <WidgetGrid manageable />
      </PageSection>
    </PageShell>
  );
}
