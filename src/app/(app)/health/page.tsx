import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHealthStatus, type CheckStatus } from "@/lib/health";
import { checkLlmHealth } from "@/lib/llm-health";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const BANNER_STYLES: Record<CheckStatus, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  degraded: "border-amber-200 bg-amber-50 text-amber-800",
  down: "border-rose-200 bg-rose-50 text-rose-800",
};

const BANNER_DOT: Record<CheckStatus, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  down: "bg-rose-500",
};

const CARD_BORDER: Record<CheckStatus, string> = {
  healthy: "border-emerald-200",
  degraded: "border-amber-200",
  down: "border-rose-200",
};

const CARD_LABEL: Record<CheckStatus, string> = {
  healthy: "text-emerald-700",
  degraded: "text-amber-700",
  down: "text-rose-700",
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default async function HealthPage() {
  const session = await getServerSession(authOptions);
  const [health, llmHealth] = await Promise.all([
    getHealthStatus(),
    checkLlmHealth(),
  ]);

  const overallLabel =
    health.status === "healthy"
      ? "All systems healthy"
      : health.status === "degraded"
        ? "Degraded performance"
        : "System down";

  const errorPct = Math.round(health.errorRate * 100);
  const avgHours =
    health.avgProcessingTimeHours === null
      ? "—"
      : `${health.avgProcessingTimeHours.toFixed(1)}h`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Health Monitor</h1>
          <p className="text-sm text-slate-500">
            Ingestion and processing status for the FeedbackFlow pipeline.
          </p>
        </div>
        <Link
          href="/api/health"
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          View JSON endpoint
        </Link>
      </div>

      {/* Overall status banner */}
      <div
        className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${BANNER_STYLES[health.status]}`}
        role="status"
      >
        <span
          className={`inline-block h-3 w-3 rounded-full ${BANNER_DOT[health.status]}`}
        />
        <div>
          <p className="font-semibold">{overallLabel}</p>
          <p className="text-xs opacity-80">
            Signed in as {session?.user?.email ?? "unknown"} · Auto-refresh not
            enabled — reload to update.
          </p>
        </div>
      </div>

      {/* LLM status */}
      <div
        className={`rounded-lg border bg-white p-4 ${CARD_BORDER[llmHealth.status]}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">LLM (AI model)</h2>
          <span
            className={`text-xs font-semibold uppercase tracking-wide ${CARD_LABEL[llmHealth.status]}`}
          >
            {llmHealth.status}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-600">{llmHealth.detail}</p>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Provider</dt>
            <dd className="font-medium text-slate-800">{llmHealth.provider}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Model</dt>
            <dd className="font-medium text-slate-800">{llmHealth.model}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Latency</dt>
            <dd className="font-medium text-slate-800">
              {llmHealth.latencyMs !== null ? `${llmHealth.latencyMs}ms` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Probe</dt>
            <dd className="font-mono text-xs text-slate-800">
              {llmHealth.probeResponse ?? "—"}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-400">
          <Link href="/api/health/llm" className="text-indigo-600 hover:underline">
            /api/health/llm
          </Link>
        </p>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Last ingest"
          value={health.lastIngest ? health.lastIngest.status : "None"}
          hint={
            health.lastIngest
              ? `${health.lastIngest.minutesAgo}m ago · ${health.lastIngest.source}`
              : "No runs recorded"
          }
        />
        <StatCard
          label="Pending analysis"
          value={String(health.pendingAnalysis)}
          hint="Items without an analysis"
        />
        <StatCard
          label="Error rate (24h)"
          value={`${errorPct}%`}
          hint="Failed ingests / total"
        />
        <StatCard
          label="Avg processing time"
          value={avgHours}
          hint="Ingest → analysis (24h)"
        />
      </div>

      {/* Check cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {health.checks.map((check) => (
          <div
            key={check.name}
            className={`rounded-lg border bg-white p-4 ${CARD_BORDER[check.status]}`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {check.name}
              </h2>
              <span
                className={`text-xs font-semibold uppercase tracking-wide ${CARD_LABEL[check.status]}`}
              >
                {check.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{check.detail}</p>
            <p className="mt-2 text-xs text-slate-400">
              Checked {formatDate(check.lastChecked)}
            </p>
          </div>
        ))}
      </div>

      {/* Last ingest detail */}
      {health.lastIngest && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-slate-900">Last ingest run</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-slate-500">Source</dt>
              <dd className="font-medium text-slate-800">
                {health.lastIngest.source}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Status</dt>
              <dd className="font-medium text-slate-800">
                {health.lastIngest.status}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Items new / fetched</dt>
              <dd className="font-medium text-slate-800">
                {health.lastIngest.itemsNew} / {health.lastIngest.itemsFetched}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">When</dt>
              <dd className="font-medium text-slate-800">
                {formatDate(health.lastIngest.createdAt)}
              </dd>
            </div>
          </dl>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Note: this page does not auto-refresh. Reload the page to fetch the
        latest health status, or poll{" "}
        <Link
          href="/api/health"
          className="text-indigo-600 hover:underline"
        >
          /api/health
        </Link>{" "}
        for live updates.
      </p>
    </div>
  );
}
