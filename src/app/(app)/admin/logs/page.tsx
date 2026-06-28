import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { RetryIngestButton } from "@/components/SourceActions";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

// D22: Ingest log viewer — admin page showing paginated ingest run history
// with status, counts, errors, and a retry button.
export default async function IngestLogsPage({
  searchParams,
}: {
  searchParams?: { page?: string; pageSize?: string; source?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const page = Math.max(
    1,
    parseInt(searchParams?.page ?? "1", 10) || 1
  );
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams?.pageSize ?? "20", 10) || 20)
  );
  const source = searchParams?.source?.trim() || undefined;

  const where = source ? { source } : {};

  const [logs, total] = await Promise.all([
    prisma.ingestLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.ingestLog.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // Preserve source filter across pagination links.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    params.set("page", String(p));
    params.set("pageSize", String(pageSize));
    if (source) params.set("source", source);
    return `/admin/logs?${params.toString()}`;
  };

  // Distinct sources for the filter dropdown.
  const distinctSources = await prisma.ingestLog.findMany({
    where: {},
    select: { source: true },
    distinct: ["source"],
    orderBy: { source: "asc" },
  });

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Ingest Logs"
        description="History of all ingestion runs."
        actions={<RetryIngestButton />}
      />

      {/* Source filter */}
      <PageSection>
        <form method="get" action="/admin/logs" className="flex items-center gap-2">
          <input type="hidden" name="page" value="1" />
          {pageSize !== 20 && (
            <input type="hidden" name="pageSize" value={String(pageSize)} />
          )}
          <label className="text-sm text-slate-600" htmlFor="source-filter">
            Source:
          </label>
          <select
            id="source-filter"
            name="source"
            defaultValue={source ?? ""}
            className="input-modern"
          >
            <option value="">All sources</option>
            {distinctSources.map((s) => (
              <option key={s.source} value={s.source}>
                {s.source}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary">
            Filter
          </button>
          {source && (
            <Link
              href={`/admin/logs?page=1&pageSize=${pageSize}`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Clear
            </Link>
          )}
        </form>
      </PageSection>

      {logs.length === 0 ? (
        <PageSection>
          <div className="card-modern p-8 text-center text-sm text-slate-400">
            No ingest logs found.
          </div>
        </PageSection>
      ) : (
        <PageSection>
          <div className="card-modern overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Source</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Fetched</th>
                  <th className="px-4 py-2 text-right">New</th>
                  <th className="px-4 py-2 text-right">Skipped</th>
                  <th className="px-4 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 hover:bg-slate-50"
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-2 text-slate-700">{log.source}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={log.status} />
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {log.itemsFetched}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {log.itemsNew}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {log.itemsSkipped}
                    </td>
                    <td
                      className="max-w-xs truncate px-4 py-2 text-slate-500"
                      title={log.error ?? ""}
                    >
                      {log.error
                        ? log.error.length > 80
                          ? log.error.slice(0, 80) + "…"
                          : log.error
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PageSection>
      )}

      {/* Pagination */}
      <PageSection>
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            {hasPrev ? (
              <Link href={pageHref(page - 1)} className="btn-secondary">
                Previous
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-300">
                Previous
              </span>
            )}
            {hasNext ? (
              <Link href={pageHref(page + 1)} className="btn-secondary">
                Next
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-300">
                Next
              </span>
            )}
          </div>
        </div>
      </PageSection>
    </PageShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "SUCCESS"
      ? "text-green-700 bg-green-100"
      : status === "PARTIAL"
      ? "text-amber-700 bg-amber-100"
      : "text-red-700 bg-red-100";
  return <span className={`rounded px-1.5 py-0.5 text-xs ${color}`}>{status}</span>;
}
