"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { formatDate } from "@/lib/utils";
import { showToast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AuditEventDto } from "@/lib/audit";

interface AuditResponse {
  events: AuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/audit?page=${page}&pageSize=${pageSize}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to load audit events (${res.status})`);
        }
        return res.json() as Promise<AuditResponse>;
      })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          showToast("Failed to load audit events", "error", err instanceof Error ? err.message : undefined);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const hasPrev = page > 1;
  const hasNext = data ? page < totalPages : false;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="System activity and changes to feedback items."
      />

      <PageSection>
        <div className="card-modern overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                <Th>Actor</Th>
                <Th>Type</Th>
                <Th>Feedback Item</Th>
                <Th>Timestamp</Th>
                <Th>Metadata</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    Loading audit events…
                  </td>
                </tr>
              ) : data?.events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                    No audit events found.
                  </td>
                </tr>
              ) : (
                data?.events.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      <div className="font-medium">{event.actor.name ?? event.actor.email}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{event.actor.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {event.type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {event.feedbackItem ? (
                        <Link
                          href={`/inbox/${event.feedbackItem.id}`}
                          className="text-sm font-medium text-slate-800 hover:text-brand-600 dark:text-slate-200 dark:hover:text-brand-300"
                        >
                          {event.feedbackItem.title ?? event.feedbackItem.externalId}
                        </Link>
                      ) : (
                        <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(event.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                      {event.meta ? (
                        <pre className="max-w-xs overflow-x-auto rounded-md bg-slate-100 p-1.5 dark:bg-slate-900/50">
                          <code>{JSON.stringify(event.meta, null, 2)}</code>
                        </pre>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </PageSection>

      {data && data.total > 0 && (
        <PageSection>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages} · {data.total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={!hasPrev}
                className={cn(
                  "btn-secondary",
                  !hasPrev && "cursor-not-allowed opacity-50"
                )}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!hasNext}
                className={cn(
                  "btn-secondary",
                  !hasNext && "cursor-not-allowed opacity-50"
                )}
              >
                Next
              </button>
            </div>
          </div>
        </PageSection>
      )}
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
