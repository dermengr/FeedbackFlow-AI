import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationPrefs } from "@/components/NotificationPrefs";
import { LanguageSelector } from "@/components/LanguageSelector";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage notification preferences and account options.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">App language</h2>
        <p className="mt-1 text-xs text-slate-500">
          UI labels are AI-translated via your configured LLM (Ollama or OpenAI).
        </p>
        <div className="mt-3">
          <LanguageSelector />
        </div>
      </div>

      <NotificationPrefs />
    </div>
  );
}