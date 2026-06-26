import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listWebhooks, VALID_EVENTS } from "@/lib/webhooks";
import { formatDate, truncate } from "@/lib/utils";
import { WebhookCreateForm } from "@/components/WebhookCreateForm";
import { WebhookRowActions } from "@/components/WebhookRowActions";

export const dynamic = "force-dynamic";

// Webhook Management page. Lists outgoing webhook configs and provides a
// simple create form at the top. Server component; the form posts to the
// /api/webhooks endpoint and refreshes the page.
export default async function WebhooksPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const webhooks = await listWebhooks();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Webhook Management</h1>
        <p className="text-sm text-slate-500">
          Configure outgoing webhooks that fire on feedback lifecycle events.
        </p>
      </div>

      <WebhookCreateForm />

      {webhooks.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No webhooks configured. Create one above to start receiving event
          notifications.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Name</Th>
                <Th>URL</Th>
                <Th>Events</Th>
                <Th>Status</Th>
                <Th>Created</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {webhooks.map((w) => (
                <tr key={w.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-800">
                    {w.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    <span className="font-mono text-xs" title={w.url}>
                      {truncate(w.url, 50)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((ev) => (
                        <span
                          key={ev}
                          className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700"
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        w.enabled
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {w.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-500">
                    {formatDate(w.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <WebhookRowActions webhookId={w.id} enabled={w.enabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-slate-400">
        Available events:{" "}
        {VALID_EVENTS.map((ev) => (
          <code key={ev} className="mr-2">
            {ev}
          </code>
        ))}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

// CreateForm is now a client component: src/components/WebhookCreateForm.tsx
