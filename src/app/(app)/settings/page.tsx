import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationPrefs } from "@/components/NotificationPrefs";
import { LanguageSelector } from "@/components/LanguageSelector";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage notification preferences and account options."
      />
      <PageSection>
        <div className="card-modern p-5">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">App language</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            UI labels are AI-translated via your configured LLM (Ollama or OpenAI).
          </p>
          <div className="mt-3">
            <LanguageSelector />
          </div>
        </div>
      </PageSection>

      <PageSection>
        <NotificationPrefs />
      </PageSection>
    </PageShell>
  );
}