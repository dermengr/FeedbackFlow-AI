import { prisma } from "@/lib/prisma";

export interface TopicTrend {
  topic: string;
  thisWeek: number;
  lastWeek: number;
  changePct: number; // percentage change, can be Infinity for new topics
  direction: "rising" | "falling" | "stable";
}

// Pure helper: classify a percentage change into a trend direction.
// - "rising"  if changePct > 20
// - "falling" if changePct < -20
// - "stable"  otherwise
// Infinity (new topic) is treated as "rising".
export function computeTrendDirection(
  changePct: number
): "rising" | "falling" | "stable" {
  if (!Number.isFinite(changePct)) {
    return "rising";
  }
  if (changePct > 20) return "rising";
  if (changePct < -20) return "falling";
  return "stable";
}

// Compute week-over-week topic frequency trends.
// Fetches feedback analyses from the last 2 weeks, counts topic occurrences
// per week, and computes the percentage change.
export async function computeTopicTrends(): Promise<TopicTrend[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const analyses = await prisma.feedbackAnalysis.findMany({
    where: { createdAt: { gte: fourteenDaysAgo } },
    select: { topics: true, createdAt: true },
  });

  const thisWeekCounts = new Map<string, number>();
  const lastWeekCounts = new Map<string, number>();

  for (const analysis of analyses) {
    const created = new Date(analysis.createdAt);
    const arr = Array.isArray(analysis.topics)
      ? (analysis.topics as unknown[])
      : [];
    const bucket =
      created >= sevenDaysAgo ? thisWeekCounts : lastWeekCounts;
    for (const t of arr) {
      if (typeof t === "string") {
        bucket.set(t, (bucket.get(t) ?? 0) + 1);
      }
    }
  }

  // Union of all topics seen in either period.
  const allTopics = new Set<string>([
    ...thisWeekCounts.keys(),
    ...lastWeekCounts.keys(),
  ]);

  const trends: TopicTrend[] = [];
  for (const topic of allTopics) {
    const thisWeek = thisWeekCounts.get(topic) ?? 0;
    const lastWeek = lastWeekCounts.get(topic) ?? 0;

    let changePct: number;
    if (lastWeek === 0) {
      // New topic this week — undefined growth represented as Infinity.
      changePct = thisWeek > 0 ? Infinity : 0;
    } else {
      changePct = ((thisWeek - lastWeek) / lastWeek) * 100;
    }

    trends.push({
      topic,
      thisWeek,
      lastWeek,
      changePct,
      direction: computeTrendDirection(changePct),
    });
  }

  // Sort by changePct descending; Infinity values sort to the top.
  trends.sort((a, b) => {
    if (a.changePct === Infinity && b.changePct === Infinity) {
      return b.thisWeek - a.thisWeek;
    }
    if (a.changePct === Infinity) return -1;
    if (b.changePct === Infinity) return 1;
    return b.changePct - a.changePct;
  });

  return trends;
}
