import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Github, Upload } from "lucide-react";

export const dynamic = "force-dynamic";

// A5: Per-source health dashboard.
// Shows each SourceConfig with its last-run status, item counts, and recent
// ingest logs. Allows enabling/disabling sources and triggering runs.
export default async function SourcesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const sources = await prisma.sourceConfig.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      ingestLogs: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  // Aggregate per-source totals from all logs.
  const totals = await prisma.ingestLog.groupBy({
    by: ["sourceConfigId"],
    where: { sourceConfigId: { not: null } },
    _sum: { itemsNew: true, itemsFetched: true },
    _count: { _all: true },
  });
  const totalsMap = new Map(
    totals
      .filter((t) => t.sourceConfigId !== null)
      .map((t) => [t.sourceConfigId as string, t])
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Data Sources</h1>
          <p className="text-sm text-slate-500">
            Configure and monitor ingestion sources.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sources/github"
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <Github className="h-4 w-4" />
            Add GitHub repo
          </Link>
          <Link
            href="/sources/upload"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-4 w-4" />
            Upload CSV
          </Link>
          <Link
            href="/sources/new"
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            + Add source
          </Link>
          <button
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => {
              fetch("/api/ingest?multi=1", { method: "POST" }).then(() =>
                window.location.reload()
              );
            }}
          >
            Run all
          </button>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No sources configured. Add a source to start ingesting feedback.
        </div>
      ) : (
        <div className="grid gap-4">
          {sources.map((src) => {
            const total = totalsMap.get(src.id);
            const lastRun = src.ingestLogs[0];
            return (
              <div
                key={src.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-slate-800">
                        {src.label}
                      </h2>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                        {src.adapter}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs ${
                          src.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {src.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {src.sourceKey}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      data-source-id={src.id}
                      data-action="toggle"
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {src.enabled ? "Disable" : "Enable"}
                    </button>
                    <button
                      data-source-id={src.id}
                      data-action="delete"
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <Stat
                    label="Total runs"
                    value={total?._count._all ?? 0}
                  />
                  <Stat
                    label="Total fetched"
                    value={total?._sum.itemsFetched ?? 0}
                  />
                  <Stat
                    label="Total new"
                    value={total?._sum.itemsNew ?? 0}
                  />
                </div>

                {lastRun && (
                  <div className="mt-3 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-500">
                      Last run: {formatDate(lastRun.createdAt)} —{" "}
                      <StatusBadge status={lastRun.status} />
                      {" · "}
                      {lastRun.itemsNew} new / {lastRun.itemsFetched} fetched
                      {lastRun.error ? ` · ${lastRun.error.slice(0, 80)}` : ""}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <script
        dangerouslySetInnerHTML={{
          __html: `
          document.querySelectorAll('[data-action="toggle"]').forEach(b => {
            b.addEventListener('click', async () => {
              const id = b.dataset.sourceId;
              await fetch('/api/sources/' + id, {
                method: 'PATCH',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ enabled: !b.textContent.includes('Disable') })
              });
              window.location.reload();
            });
          });
          document.querySelectorAll('[data-action="delete"]').forEach(b => {
            b.addEventListener('click', async () => {
              if (!confirm('Delete this source?')) return;
              const id = b.dataset.sourceId;
              await fetch('/api/sources/' + id, { method: 'DELETE' });
              window.location.reload();
            });
          });
        `,
        }}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-slate-50 p-2">
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
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
