import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { SearchHistory } from "@/components/SearchHistory";

export const dynamic = "force-dynamic";

export default async function SearchHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Search History"
        description="Recent searches across FeedbackFlow."
      />

      <PageSection>
        <SearchHistory />
      </PageSection>
    </PageShell>
  );
}
