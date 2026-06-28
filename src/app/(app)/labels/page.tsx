import { listLabels } from "@/lib/labels";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { LabelsManager } from "@/components/LabelsManager";

export const dynamic = "force-dynamic";

export default async function LabelsPage() {
  const labels = await listLabels();

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Labels"
        description="Create and manage labels used to categorize feedback."
      />

      <PageSection>
        <LabelsManager initialLabels={labels} />
      </PageSection>
    </PageShell>
  );
}
