// Feedback Comparison
//
// Compares feedback across two time periods or two sources. For each side we
// compute: total items, sentiment distribution (percentages), average severity,
// top 5 topics, and status distribution. We then compute deltas between the two
// sides (total items, positive rate, average severity, and a per-topic delta
// across the union of each side's top topics).
//
// Used by:
//   - GET /api/comparison (dashboard comparison panel)
//   - src/components/ComparisonView.tsx

import { prisma } from "@/lib/prisma";
import type { Sentiment } from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const SENTIMENTS: readonly Sentiment[] = ["positive", "neutral", "negative"];

// A single analysis row, decoupled from Prisma so the aggregation logic is
// trivially unit-testable with plain arrays.
export interface ComparisonAnalysisRow {
  sentiment: string;
  status: string;
  severityScore: number;
  topics: unknown;
}

export interface TopicCount {
  topic: string;
  count: number;
}

export interface PeriodStats {
  totalItems: number;
  // Sentiment distribution as percentages (0-100), rounded to 1 decimal.
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  // Average severity score (1-5), rounded to 2 decimals. 0 when no items.
  avgSeverity: number;
  // Top 5 topics by occurrence count, descending.
  topTopics: TopicCount[];
  // Raw counts per status (e.g. NEW / ACKNOWLEDGED / ACTIONED).
  statusDistribution: Record<string, number>;
}

export interface TopicDelta {
  topic: string;
  p1Count: number;
  p2Count: number;
  delta: number; // p2Count - p1Count
}

export interface ComparisonDeltas {
  // Absolute difference in item counts (p2 - p1).
  totalItems: number;
  // Percentage-point difference in positive sentiment rate (p2 - p1).
  positiveRate: number;
  // Difference in average severity (p2 - p1).
  avgSeverity: number;
  // Per-topic deltas across the union of each side's top topics.
  topTopics: TopicDelta[];
}

export interface ComparisonResult {
  period1: PeriodStats;
  period2: PeriodStats;
  deltas: ComparisonDeltas;
}

export interface SourceComparisonResult {
  source1: string;
  source2: string;
  days: number;
  period1: PeriodStats;
  period2: PeriodStats;
  deltas: ComparisonDeltas;
}

// ---------------------------------------------------------------------------
// Aggregation (pure)
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Aggregate an array of analysis rows into a PeriodStats summary. Pure: no DB
// access, no I/O. Rows with unknown sentiments still count toward totalItems
// and status/severity/topic stats, but do not appear in sentimentDistribution
// (which only tracks the three canonical sentiments).
export function aggregatePeriodStats(
  rows: ComparisonAnalysisRow[]
): PeriodStats {
  const totalItems = rows.length;

  const sentimentCounts: Record<string, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  const statusDistribution: Record<string, number> = {};
  const topicCounts: Record<string, number> = {};
  let severitySum = 0;

  for (const row of rows) {
    if (SENTIMENTS.includes(row.sentiment as Sentiment)) {
      sentimentCounts[row.sentiment] += 1;
    }
    statusDistribution[row.status] = (statusDistribution[row.status] ?? 0) + 1;

    const topics = Array.isArray(row.topics) ? (row.topics as unknown[]) : [];
    for (const t of topics) {
      if (typeof t === "string") {
        topicCounts[t] = (topicCounts[t] ?? 0) + 1;
      }
    }

    severitySum += row.severityScore;
  }

  const sentimentDistribution = {
    positive: totalItems > 0 ? round1((sentimentCounts.positive / totalItems) * 100) : 0,
    neutral: totalItems > 0 ? round1((sentimentCounts.neutral / totalItems) * 100) : 0,
    negative: totalItems > 0 ? round1((sentimentCounts.negative / totalItems) * 100) : 0,
  };

  const avgSeverity = totalItems > 0 ? round2(severitySum / totalItems) : 0;

  const topTopics: TopicCount[] = Object.entries(topicCounts)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic))
    .slice(0, 5);

  return {
    totalItems,
    sentimentDistribution,
    avgSeverity,
    topTopics,
    statusDistribution,
  };
}

// Pure function: compute the deltas between two PeriodStats summaries.
// - totalItems: p2.totalItems - p1.totalItems
// - positiveRate: p2.positive% - p1.positive% (percentage points)
// - avgSeverity: p2.avgSeverity - p1.avgSeverity
// - topTopics: union of p1 and p2 top topics, with per-topic count delta.
export function calculateDeltas(
  p1: PeriodStats,
  p2: PeriodStats
): ComparisonDeltas {
  const totalItems = p2.totalItems - p1.totalItems;
  const positiveRate = round1(
    p2.sentimentDistribution.positive - p1.sentimentDistribution.positive
  );
  const avgSeverity = round2(p2.avgSeverity - p1.avgSeverity);

  // Build a map of topic -> count for each side (top topics only).
  const p1Map = new Map<string, number>();
  for (const t of p1.topTopics) p1Map.set(t.topic, t.count);
  const p2Map = new Map<string, number>();
  for (const t of p2.topTopics) p2Map.set(t.topic, t.count);

  const allTopics = new Set<string>([
    ...p1Map.keys(),
    ...p2Map.keys(),
  ]);

  const topTopics: TopicDelta[] = Array.from(allTopics)
    .map((topic) => {
      const p1Count = p1Map.get(topic) ?? 0;
      const p2Count = p2Map.get(topic) ?? 0;
      return { topic, p1Count, p2Count, delta: p2Count - p1Count };
    })
    // Sort by absolute delta magnitude descending, then topic name.
    .sort(
      (a, b) =>
        Math.abs(b.delta) - Math.abs(a.delta) || a.topic.localeCompare(b.topic)
    );

  return { totalItems, positiveRate, avgSeverity, topTopics };
}

// ---------------------------------------------------------------------------
// DB-backed comparisons
// ---------------------------------------------------------------------------

// Map a Prisma row (analysis + nested feedbackItem) into the pure row shape.
type PrismaRow = {
  sentiment: string;
  status: string;
  severityScore: number;
  topics: unknown;
};

// Compare feedback across two time periods. Time filtering uses the
// FeedbackItem.originalTimestamp (when feedback was actually submitted).
export async function comparePeriods(
  period1Start: Date,
  period1End: Date,
  period2Start: Date,
  period2End: Date
): Promise<ComparisonResult> {
  const [rows1, rows2] = await Promise.all([
    prisma.feedbackAnalysis.findMany({
      where: {
        feedbackItem: {
          originalTimestamp: { gte: period1Start, lte: period1End },
        },
      },
      select: {
        sentiment: true,
        status: true,
        severityScore: true,
        topics: true,
      },
    }),
    prisma.feedbackAnalysis.findMany({
      where: {
        feedbackItem: {
          originalTimestamp: { gte: period2Start, lte: period2End },
        },
      },
      select: {
        sentiment: true,
        status: true,
        severityScore: true,
        topics: true,
      },
    }),
  ]);

  const period1 = aggregatePeriodStats(rows1 as PrismaRow[]);
  const period2 = aggregatePeriodStats(rows2 as PrismaRow[]);
  const deltas = calculateDeltas(period1, period2);

  return { period1, period2, deltas };
}

// Compare feedback across two sources over the same trailing time range
// (last `days` days, measured from now via FeedbackItem.originalTimestamp).
export async function compareSources(
  source1: string,
  source2: string,
  days: number = 30
): Promise<SourceComparisonResult> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [rows1, rows2] = await Promise.all([
    prisma.feedbackAnalysis.findMany({
      where: {
        feedbackItem: {
          source: source1,
          originalTimestamp: { gte: cutoff },
        },
      },
      select: {
        sentiment: true,
        status: true,
        severityScore: true,
        topics: true,
      },
    }),
    prisma.feedbackAnalysis.findMany({
      where: {
        feedbackItem: {
          source: source2,
          originalTimestamp: { gte: cutoff },
        },
      },
      select: {
        sentiment: true,
        status: true,
        severityScore: true,
        topics: true,
      },
    }),
  ]);

  const period1 = aggregatePeriodStats(rows1 as PrismaRow[]);
  const period2 = aggregatePeriodStats(rows2 as PrismaRow[]);
  const deltas = calculateDeltas(period1, period2);

  return { source1, source2, days, period1, period2, deltas };
}
