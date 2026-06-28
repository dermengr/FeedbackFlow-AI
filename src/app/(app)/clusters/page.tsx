import { ClustersView } from "@/components/ClustersView";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

// Semantic clustering page — groups feedback items by embedding similarity.
export default function ClustersPage() {
  return (
    <PageShell className="space-y-4">
      <PageHeader
        title="Semantic Clusters"
        description="Feedback items grouped by semantic similarity. Adjust the threshold to control how tightly items are clustered together."
      />
      <PageSection>
        <ClustersView />
      </PageSection>
    </PageShell>
  );
}
