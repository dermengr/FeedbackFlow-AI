import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTemplates } from "@/lib/export-templates";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { ExportTemplatesManager } from "@/components/ExportTemplatesManager";

export const dynamic = "force-dynamic";

export default async function ExportTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const templates = await listTemplates(session.user.id);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Export Templates"
        description="Save reusable column layouts for feedback exports."
      />

      <PageSection>
        <ExportTemplatesManager initialTemplates={templates} />
      </PageSection>
    </PageShell>
  );
}
