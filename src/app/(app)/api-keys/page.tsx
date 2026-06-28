import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys";
import { formatDate } from "@/lib/utils";
import { ApiKeyForm } from "./ApiKeyForm";
import { ApiKeyRowActions } from "@/components/ApiKeyRowActions";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

// API Key Management page. Lists the current user's API keys (without hashes)
// and provides a form to generate new keys. The raw key is shown only once at
// creation time inside the form.
export default async function ApiKeysPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const keys = await listApiKeys(session.user.id);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="API Keys"
        description="Generate and manage API keys for external access."
      />

      <PageSection>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 backdrop-blur-sm dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700/50">
          <strong className="font-semibold">Security note:</strong> Raw API keys
          are shown only once when created. Store them securely — you will not be
          able to retrieve them again. If you lose a key, delete it and create a
          new one.
        </div>
      </PageSection>

      <PageSection>
        <ApiKeyForm />
      </PageSection>

      <PageSection>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Your API keys</h2>
        {keys.length === 0 ? (
          <div className="mt-2 card-modern p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No API keys yet. Create one above to get started.
          </div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:bg-slate-800 dark:border-slate-700">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Prefix
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Scopes
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Last Used
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {keys.map((key) => (
                  <tr key={key.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {key.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {key.prefix}…
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.length === 0 ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            No scopes
                          </span>
                        ) : (
                          key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                            >
                              {scope}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(key.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <ApiKeyRowActions keyId={key.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}
