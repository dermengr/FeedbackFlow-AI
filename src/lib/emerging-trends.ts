import { prisma } from "@/lib/prisma";
import { TOPIC_TAXONOMY, type Topic } from "@/lib/types";

export type TrendDirection = "rising" | "stable" | "declining";

export interface EmergingTrend {
  topic: Topic;
  currentCount: number;
  previousCount: number;
  growthRate: number; // percentage change; Infinity for brand-new topics
  trend: TrendDirection;
}

// Pure helper: classify a growth rate into a trend direction.
// - "rising"    if growthRate > 50
// - "declining" if growthRate < -25
// - "stable"    otherwise
// Infinity (previousCount === 0, currentCount > 0) is treated as "rising".
export function classifyTrend(growthRate: number): TrendDirection {
  if (!Number.isFinite(growthRate)) {
    return "rising";
  }
  if (growthRate > 50) return "rising";
  if (growthRate < -25) return "declining";
  return "stable";
}

// Detects topics that are growing in frequency compared to the previous
// equal-length window. For each topic in TOPIC_TAXONOMY, counts occurrences
// in the recent `windowDays` window and the immediately preceding window of
// the same length, then computes the growth rate.
//
// Growth rate > 50%  => "rising"
// Growth rate < -25% => "declining"
// Otherwise          => "stable"
//
// When previousCount is 0 and currentCount > 0, growthRate is Infinity
// (treated as "rising"). When both counts are 0, growthRate is 0 ("stable").
export async function detectEmergingTrends(
  windowDays: number
): Promise<EmergingTrend[]> {
  const now = new Date();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const recentStart = new Date(now.getTime() - windowMs);
  const previousStart = new Date(now.getTime() - 2 * windowMs);

  const analyses = await prisma.feedbackAnalysis.findMany({
    where: { createdAt: { gte: previousStart } },
    select: { topics: true, createdAt: true },
  });

  const currentCounts = new Map<Topic, number>();
  const previousCounts = new Map<Topic, number>();

  for (const topic of TOPIC_TAXONOMY) {
    currentCounts.set(topic, 0);
    previousCounts.set(topic, 0);
  }

  for (const analysis of analyses) {
    const created = new Date(analysis.createdAt);
    const bucket = created >= recentStart ? currentCounts : previousCounts;
    const arr = Array.isArray(analysis.topics)
      ? (analysis.topics as unknown[])
      : [];
    for (const t of arr) {
      if (typeof t === "string") {
        const match = TOPIC_TAXONOMY.find((x) => x === t);
        if (match) {
          bucket.set(match, (bucket.get(match) ?? 0) + 1);
        }
      }
    }
  }

  const trends: EmergingTrend[] = TOPIC_TAXONOMY.map((topic) => {
    const currentCount = currentCounts.get(topic) ?? 0;
    const previousCount = previousCounts.get(topic) ?? 0;

    let growthRate: number;
    if (previousCount === 0) {
      // Division by zero: new topic in the current window.
      growthRate = currentCount > 0 ? Infinity : 0;
    } else {
      growthRate = ((currentCount - previousCount) / previousCount) * 100;
    }

    return {
      topic,
      currentCount,
      previousCount,
      growthRate,
      trend: classifyTrend(growthRate),
    };
  });

  // Sort by growthRate descending; Infinity values sort to the top.
  trends.sort((a, b) => {
    if (a.growthRate === Infinity && b.growthRate === Infinity) {
      return b.currentCount - a.currentCount;
    }
    if (a.growthRate === Infinity) return -1;
    if (b.growthRate === Infinity) return 1;
    return b.growthRate - a.growthRate;
  });

  return trends;
}
