import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTemplates } from "@/lib/reply-templates";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { ReplyTemplatesManager } from "@/components/ReplyTemplatesManager";

export const dynamic = "force-dynamic";

export default async function ReplyTemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const templates = await listTemplates(session.user.id);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Reply Templates"
        description="Create and manage reusable replies for your team."
      />

      <PageSection>
        <ReplyTemplatesManager initialTemplates={templates} />
      </PageSection>
    </PageShell>
  );
}
