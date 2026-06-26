import { prisma } from "@/lib/prisma";

export type MetricsPeriod = "daily" | "weekly" | "monthly";

export interface TeamMemberMetrics {
  userId: string;
  userName: string;
  email: string;
  assignedCount: number;
  actionedCount: number;
  avgResponseHours: number;
  actionedRate: number;
}

// Compute the [periodStart, periodEnd) window for a given period granularity.
// - daily   => last 24 hours
// - weekly  => last 7 days
// - monthly => last 30 days
export function getPeriodRange(period: MetricsPeriod): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodEnd = new Date();
  const hours =
    period === "daily" ? 24 : period === "weekly" ? 24 * 7 : 24 * 30;
  const periodStart = new Date(periodEnd.getTime() - hours * 60 * 60 * 1000);
  return { periodStart, periodEnd };
}

// Compute a single team member's metrics from their assigned analyses.
// Exposed for unit testing without hitting the database.
export function computeMemberMetrics(
  userId: string,
  userName: string,
  email: string,
  analyses: { status: string; createdAt: Date; updatedAt: Date }[]
): TeamMemberMetrics {
  const assignedCount = analyses.length;
  const actioned = analyses.filter((a) => a.status === "ACTIONED");
  const actionedCount = actioned.length;

  let avgResponseHours = 0;
  if (actioned.length > 0) {
    const totalHours = actioned.reduce((sum, a) => {
      const diffMs =
        new Date(a.updatedAt).getTime() - new Date(a.createdAt).getTime();
      return sum + Math.max(0, diffMs) / (1000 * 60 * 60);
    }, 0);
    avgResponseHours = totalHours / actioned.length;
  }

  const actionedRate =
    assignedCount > 0 ? (actionedCount / assignedCount) * 100 : 0;

  return {
    userId,
    userName,
    email,
    assignedCount,
    actionedCount,
    avgResponseHours,
    actionedRate,
  };
}

// Query all users and compute per-member triage performance for the period.
// Only feedback assigned within the period window is counted.
export async function getTeamMetrics(
  period: MetricsPeriod = "weekly"
): Promise<TeamMemberMetrics[]> {
  const { periodStart, periodEnd } = getPeriodRange(period);

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  const analyses = await prisma.feedbackAnalysis.findMany({
    where: {
      assignedToId: { not: null },
      createdAt: { gte: periodStart, lt: periodEnd },
    },
    select: {
      assignedToId: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const byUser = new Map<string, { status: string; createdAt: Date; updatedAt: Date }[]>();
  for (const a of analyses) {
    if (!a.assignedToId) continue;
    const arr = byUser.get(a.assignedToId) ?? [];
    arr.push({
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    });
    byUser.set(a.assignedToId, arr);
  }

  return users.map((u) =>
    computeMemberMetrics(
      u.id,
      u.name ?? u.email,
      u.email,
      byUser.get(u.id) ?? []
    )
  );
}

// Persist a snapshot of the current period's metrics into the TeamMetric
// table. Uses upsert keyed on (userId, period, periodStart) so re-running
// for the same period updates rather than duplicates.
export async function snapshotTeamMetrics(
  period: MetricsPeriod = "weekly"
): Promise<void> {
  const { periodStart, periodEnd } = getPeriodRange(period);
  const metrics = await getTeamMetrics(period);

  await Promise.all(
    metrics.map((m) =>
      prisma.teamMetric.upsert({
        where: {
          userId_period_periodStart: {
            userId: m.userId,
            period,
            periodStart,
          },
        },
        update: {
          assignedCount: m.assignedCount,
          actionedCount: m.actionedCount,
          avgResponseHours: m.avgResponseHours,
        },
        create: {
          userId: m.userId,
          period,
          periodStart,
          periodEnd,
          assignedCount: m.assignedCount,
          actionedCount: m.actionedCount,
          avgResponseHours: m.avgResponseHours,
        },
      })
    )
  );
}
