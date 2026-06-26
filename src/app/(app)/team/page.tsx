import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTeamMetrics, getPeriodRange, type MetricsPeriod } from "@/lib/team-metrics";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PERIODS: MetricsPeriod[] = ["daily", "weekly", "monthly"];

export default async function TeamPage({
  searchParams,
}: {
  searchParams?: { period?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const periodParam = searchParams?.period ?? "weekly";
  const period: MetricsPeriod = PERIODS.includes(periodParam as MetricsPeriod)
    ? (periodParam as MetricsPeriod)
    : "weekly";

  const metrics = await getTeamMetrics(period);
  const { periodStart, periodEnd } = getPeriodRange(period);

  // Best performer: highest actioned rate among members with at least one
  // assignment. Ties broken by higher actioned count, then lower avg response.
  const eligible = metrics.filter((m) => m.assignedCount > 0);
  let bestId: string | null = null;
  if (eligible.length > 0) {
    const best = [...eligible].sort((a, b) => {
      if (b.actionedRate !== a.actionedRate) return b.actionedRate - a.actionedRate;
      if (b.actionedCount !== a.actionedCount) return b.actionedCount - a.actionedCount;
      return a.avgResponseHours - b.avgResponseHours;
    })[0];
    bestId = best.userId;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Team Performance Metrics</h1>
          <p className="text-sm text-slate-500">
            Per-team-member triage performance for the selected period.
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
          {PERIODS.map((p) => (
            <a
              key={p}
              href={`/team?period=${p}`}
              className={`rounded px-3 py-1 text-sm font-medium capitalize transition-colors ${
                p === period
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </a>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Period: {formatDate(periodStart)} — {formatDate(periodEnd)}
      </p>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <Th>Name</Th>
              <Th align="right">Assigned</Th>
              <Th align="right">Actioned</Th>
              <Th align="right">Actioned Rate</Th>
              <Th align="right">Avg Response (hours)</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">
                  No team members yet.
                </td>
              </tr>
            ) : (
              metrics.map((m) => {
                const isBest = m.userId === bestId;
                return (
                  <tr
                    key={m.userId}
                    className={isBest ? "bg-indigo-50" : "hover:bg-slate-50"}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {m.userName}
                        </span>
                        {isBest && (
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                            Top performer
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{m.email}</div>
                    </td>
                    <Td align="right">{m.assignedCount}</Td>
                    <Td align="right">{m.actionedCount}</Td>
                    <Td align="right">
                      {m.assignedCount > 0
                        ? `${m.actionedRate.toFixed(1)}%`
                        : "—"}
                    </Td>
                    <Td align="right">
                      {m.actionedCount > 0
                        ? m.avgResponseHours.toFixed(1)
                        : "—"}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <td
      className={`px-4 py-3 text-sm text-slate-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </td>
  );
}
