import { prisma } from "@/lib/prisma";

// Shape returned by getRealtimeStats(). All counts are integers; the
// recent ingest runs are the raw (select-reduced) log rows, newest first.
export interface RealtimeStats {
  lastHourItems: number;
  pendingTriage: number;
  unassignedHighSeverity: number;
  lastHourComments: number;
  recentIngestRuns: {
    id: string;
    source: string;
    status: string;
    itemsNew: number;
    itemsFetched: number;
    createdAt: Date;
  }[];
}

// One hour in milliseconds. Exported so tests can reference the window.
export const ONE_HOUR_MS = 60 * 60 * 1000;

// Compute live dashboard stats:
//   - items created in the last 1 hour
//   - items pending triage (status = NEW)
//   - high severity items (severityScore >= 4) without an assignee
//   - comments posted in the last hour
//   - the 5 most recent ingest runs
export async function getRealtimeStats(): Promise<RealtimeStats> {
  const oneHourAgo = new Date(Date.now() - ONE_HOUR_MS);

  const [
    lastHourItems,
    pendingTriage,
    unassignedHighSeverity,
    lastHourComments,
    recentIngestRuns,
  ] = await Promise.all([
    prisma.feedbackItem.count({
      where: { createdAt: { gte: oneHourAgo } },
    }),
    prisma.feedbackAnalysis.count({
      where: { status: "NEW" },
    }),
    prisma.feedbackAnalysis.count({
      where: {
        severityScore: { gte: 4 },
        assignedToId: null,
      },
    }),
    prisma.feedbackComment.count({
      where: { createdAt: { gte: oneHourAgo } },
    }),
    prisma.ingestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        source: true,
        status: true,
        itemsNew: true,
        itemsFetched: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    lastHourItems,
    pendingTriage,
    unassignedHighSeverity,
    lastHourComments,
    recentIngestRuns,
  };
}

// Relative-time formatter: "just now", "5m ago", "2h ago", "3d ago".
export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(date).getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

// Display-ready view of the realtime stats. Counts are turned into short
// human-readable labels and ingest runs get a relative timestamp.
export function formatStatsForDisplay(
  stats: RealtimeStats,
  now: Date = new Date()
) {
  return {
    lastHourItems: {
      value: stats.lastHourItems,
      label:
        stats.lastHourItems === 1
          ? "1 item in last hour"
          : `${stats.lastHourItems} items in last hour`,
    },
    pendingTriage: {
      value: stats.pendingTriage,
      label:
        stats.pendingTriage === 1
          ? "1 pending triage"
          : `${stats.pendingTriage} pending triage`,
    },
    unassignedHighSeverity: {
      value: stats.unassignedHighSeverity,
      label:
        stats.unassignedHighSeverity === 1
          ? "1 unassigned critical"
          : `${stats.unassignedHighSeverity} unassigned critical`,
    },
    lastHourComments: {
      value: stats.lastHourComments,
      label:
        stats.lastHourComments === 1
          ? "1 comment in last hour"
          : `${stats.lastHourComments} comments in last hour`,
    },
    recentIngestRuns: stats.recentIngestRuns.map((run) => ({
      id: run.id,
      source: run.source,
      status: run.status,
      itemsNew: run.itemsNew,
      itemsFetched: run.itemsFetched,
      createdAt: run.createdAt,
      relativeTime: formatRelativeTime(run.createdAt, now),
    })),
  };
}
