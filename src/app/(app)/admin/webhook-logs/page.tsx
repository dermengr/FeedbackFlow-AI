import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { listWebhooks } from "@/lib/webhooks";
import { getUserRoles } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { WebhookTestButton } from "@/components/WebhookTestButton";

export const dynamic = "force-dynamic";

export default async function WebhookLogsPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) redirect("/login");

  const roles = await getUserRoles(userId);
  if (!roles.includes("Admin")) redirect("/dashboard");

  const webhooks = await listWebhooks();

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Webhook Delivery Logs"
        description="Overview of configured webhooks and delivery status."
      />

      <PageSection>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-sm text-amber-800 backdrop-blur-sm dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700/50">
          Persistent webhook delivery logs require a dedicated database model.
          For now, this page lists configured webhooks and lets you send a test
          ping.
        </div>
      </PageSection>

      <PageSection>
        {webhooks.length === 0 ? (
          <div className="card-modern p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No webhooks configured.
          </div>
        ) : (
          <div className="card-modern overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                <tr>
                  <Th>Name</Th>
                  <Th>URL</Th>
                  <Th>Events</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {webhooks.map((w) => (
                  <tr key={w.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                      {w.name}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-mono" title={w.url}>
                        {w.url}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((ev) => (
                          <span
                            key={ev}
                            className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                          >
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-xs ${
                          w.enabled
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-700/50 dark:text-slate-400"
                        }`}
                      >
                        {w.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(w.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <WebhookTestButton webhookId={w.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </PageSection>
    </PageShell>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
      {children}
    </th>
  );
}
