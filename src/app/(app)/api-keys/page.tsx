import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listApiKeys } from "@/lib/api-keys";
import { formatDate } from "@/lib/utils";
import { ApiKeyForm } from "./ApiKeyForm";
import { ApiKeyRowActions } from "@/components/ApiKeyRowActions";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">API Keys</h1>
        <p className="text-sm text-slate-500">
          Generate and manage API keys for external access.
        </p>
      </div>

      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
        <strong className="font-semibold">Security note:</strong> Raw API keys
        are shown only once when created. Store them securely — you will not be
        able to retrieve them again. If you lose a key, delete it and create a
        new one.
      </div>

      <ApiKeyForm />

      <div>
        <h2 className="text-sm font-semibold text-slate-800">Your API keys</h2>
        {keys.length === 0 ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
            No API keys yet. Create one above to get started.
          </div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Prefix
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Scopes
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Last Used
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Created
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {key.name}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {key.prefix}…
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {key.scopes.length === 0 ? (
                          <span className="text-xs text-slate-400">
                            No scopes
                          </span>
                        ) : (
                          key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700"
                            >
                              {scope}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
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
      </div>
    </div>
  );
}
