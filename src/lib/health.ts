import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Health Monitor
//
// Aggregates ingestion + processing signals into a single overall status plus
// a list of individual checks. Used by the /api/health endpoint and the
// health dashboard page.
// ---------------------------------------------------------------------------

export type CheckStatus = "healthy" | "degraded" | "down";

export interface HealthCheck {
  name: string;
  status: CheckStatus;
  detail: string;
  lastChecked: Date;
}

export interface LastIngestInfo {
  status: string;
  source: string;
  itemsNew: number;
  itemsFetched: number;
  createdAt: Date;
  minutesAgo: number;
}

export interface HealthStatus {
  status: CheckStatus;
  checks: HealthCheck[];
  lastIngest: LastIngestInfo | null;
  pendingAnalysis: number;
  errorRate: number;
  avgProcessingTimeHours: number | null;
}

// Tunable thresholds. Kept as module-level constants so tests can reason
// about the boundary conditions.
const STALE_INGEST_MINUTES = 360; // 6h with no successful ingest => degraded
const PENDING_DEGRADED = 50;
const PENDING_DOWN = 200;
const ERROR_RATE_DEGRADED = 0.2;
const ERROR_RATE_DOWN = 0.5;
const PROCESSING_DEGRADED_HOURS = 6;
const PROCESSING_DOWN_HOURS = 24;
const LOOKBACK_HOURS = 24;

/**
 * Pure function: derive the overall status from a list of checks.
 * - any "down"  -> "down"
 * - any "degraded" (and no "down") -> "degraded"
 * - otherwise -> "healthy"
 *
 * Exported separately so it can be unit-tested without a database.
 */
export function determineOverallStatus(checks: HealthCheck[]): CheckStatus {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "healthy";
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
}

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 3_600_000);
}

/**
 * Compute the health status of the ingestion + processing pipeline.
 * Runs four checks:
 *   1. Ingestion — based on the most recent IngestLog run.
 *   2. Pending analysis — FeedbackItems that have no linked analysis yet.
 *   3. Error rate — failed ingests / total ingests in the last 24h.
 *   4. Processing time — avg hours between FeedbackItem.createdAt and the
 *      linked FeedbackAnalysis.createdAt.
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const now = new Date();

  // (a) Last ingest run -----------------------------------------------------
  const lastIngestLog = await prisma.ingestLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  let lastIngest: LastIngestInfo | null = null;
  if (lastIngestLog) {
    lastIngest = {
      status: lastIngestLog.status,
      source: lastIngestLog.source,
      itemsNew: lastIngestLog.itemsNew,
      itemsFetched: lastIngestLog.itemsFetched,
      createdAt: lastIngestLog.createdAt,
      minutesAgo: minutesBetween(lastIngestLog.createdAt, now),
    };
  }

  const ingestCheck: HealthCheck = (() => {
    const lastChecked = now;
    if (!lastIngestLog) {
      return {
        name: "Ingestion",
        status: "degraded",
        detail: "No ingest runs recorded yet.",
        lastChecked,
      };
    }
    const minsAgo = minutesBetween(lastIngestLog.createdAt, now);
    if (lastIngestLog.status === "FAILURE") {
      return {
        name: "Ingestion",
        status: "down",
        detail: `Last run failed (${lastIngestLog.source}) ${minsAgo}m ago.`,
        lastChecked,
      };
    }
    if (lastIngestLog.status === "PARTIAL") {
      return {
        name: "Ingestion",
        status: "degraded",
        detail: `Last run partial (${lastIngestLog.source}) ${minsAgo}m ago.`,
        lastChecked,
      };
    }
    if (minsAgo > STALE_INGEST_MINUTES) {
      return {
        name: "Ingestion",
        status: "degraded",
        detail: `Last successful run was ${minsAgo}m ago (stale).`,
        lastChecked,
      };
    }
    return {
      name: "Ingestion",
      status: "healthy",
      detail: `Last run succeeded (${lastIngestLog.source}) ${minsAgo}m ago.`,
      lastChecked,
    };
  })();

  // (b) Items pending analysis ---------------------------------------------
  const pendingAnalysis = await prisma.feedbackItem.count({
    where: { analysis: { is: null } },
  });

  const pendingCheck: HealthCheck = {
    name: "Pending analysis",
    status:
      pendingAnalysis >= PENDING_DOWN
        ? "down"
        : pendingAnalysis >= PENDING_DEGRADED
          ? "degraded"
          : "healthy",
    detail:
      pendingAnalysis === 0
        ? "No items waiting for analysis."
        : `${pendingAnalysis} item${pendingAnalysis === 1 ? "" : "s"} pending analysis.`,
    lastChecked: now,
  };

  // (c) Error rate over the last 24h ---------------------------------------
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000);
  const [totalIngests, failedIngests] = await Promise.all([
    prisma.ingestLog.count({ where: { createdAt: { gte: since } } }),
    prisma.ingestLog.count({
      where: { createdAt: { gte: since }, status: "FAILURE" },
    }),
  ]);
  const errorRate = totalIngests > 0 ? failedIngests / totalIngests : 0;

  const errorRateCheck: HealthCheck = (() => {
    if (totalIngests === 0) {
      return {
        name: "Error rate (24h)",
        status: "degraded",
        detail: "No ingest runs in the last 24h.",
        lastChecked: now,
      };
    }
    const pct = Math.round(errorRate * 100);
    const status: CheckStatus =
      errorRate >= ERROR_RATE_DOWN
        ? "down"
        : errorRate >= ERROR_RATE_DEGRADED
          ? "degraded"
          : "healthy";
    return {
      name: "Error rate (24h)",
      status,
      detail: `${failedIngests}/${totalIngests} runs failed (${pct}%).`,
      lastChecked: now,
    };
  })();

  // (d) Avg processing time -------------------------------------------------
  // Time between FeedbackItem.createdAt and the linked FeedbackAnalysis.createdAt.
  const analysed = await prisma.feedbackAnalysis.findMany({
    where: { feedbackItem: { createdAt: { gte: since } } },
    select: { createdAt: true, feedbackItem: { select: { createdAt: true } } },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  let avgProcessingTimeHours: number | null = null;
  if (analysed.length > 0) {
    const totalHours = analysed.reduce((sum, a) => {
      return sum + hoursBetween(a.feedbackItem.createdAt, a.createdAt);
    }, 0);
    avgProcessingTimeHours = totalHours / analysed.length;
  }

  const processingCheck: HealthCheck = (() => {
    if (avgProcessingTimeHours === null) {
      return {
        name: "Avg processing time",
        status: "degraded",
        detail: "No items analysed in the last 24h.",
        lastChecked: now,
      };
    }
    const hrs = avgProcessingTimeHours.toFixed(1);
    const status: CheckStatus =
      avgProcessingTimeHours >= PROCESSING_DOWN_HOURS
        ? "down"
        : avgProcessingTimeHours >= PROCESSING_DEGRADED_HOURS
          ? "degraded"
          : "healthy";
    return {
      name: "Avg processing time",
      status,
      detail: `Average ${hrs}h from ingest to analysis.`,
      lastChecked: now,
    };
  })();

  const checks: HealthCheck[] = [
    ingestCheck,
    pendingCheck,
    errorRateCheck,
    processingCheck,
  ];

  return {
    status: determineOverallStatus(checks),
    checks,
    lastIngest,
    pendingAnalysis,
    errorRate,
    avgProcessingTimeHours,
  };
}
