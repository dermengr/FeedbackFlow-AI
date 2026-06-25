import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/dashboard - aggregated metrics for the dashboard.
// Returns:
//   - totals (by sentiment, by status)
//   - severity distribution
//   - topic distribution (counts per topic across all analyses)
//   - sentiment trend (last 14 days, by day)
//   - recent high-severity items
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sentiment counts
  const sentimentGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["sentiment"],
    _count: { _all: true },
  });

  // Status counts
  const statusGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  // Severity distribution
  const severityGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["severityScore"],
    _count: { _all: true },
  });

  // Topic distribution: topics is a JSON array; we read all and count in JS.
  // For larger datasets this would become a SQL aggregation, but for an SMB
  // tool this is fine.
  const allTopics = await prisma.feedbackAnalysis.findMany({
    select: { topics: true },
  });
  const topicCounts = new Map<string, number>();
  for (const row of allTopics) {
    const arr = Array.isArray(row.topics) ? (row.topics as unknown[]) : [];
    for (const t of arr) {
      if (typeof t === "string") {
        topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
      }
    }
  }

  // Sentiment trend over the last 14 days, based on the feedback item's
  // original timestamp.
  const since = new Date();
  since.setDate(since.getDate() - 14);
  since.setHours(0, 0, 0, 0);

  const recentItems = await prisma.feedbackItem.findMany({
    where: { originalTimestamp: { gte: since } },
    select: {
      originalTimestamp: true,
      analysis: { select: { sentiment: true } },
    },
  });

  const days: { date: string; positive: number; neutral: number; negative: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({
      date: d.toISOString().slice(0, 10),
      positive: 0,
      neutral: 0,
      negative: 0,
    });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const it of recentItems) {
    const key = new Date(it.originalTimestamp).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket && it.analysis?.sentiment) {
      bucket[it.analysis.sentiment as "positive" | "neutral" | "negative"]++;
    }
  }

  // Recent high-severity items (>=4), newest first, top 5
  const highSeverity = await prisma.feedbackItem.findMany({
    where: { analysis: { severityScore: { gte: 4 } } },
    include: { analysis: true },
    orderBy: { originalTimestamp: "desc" },
    take: 5,
  });

  const totalAnalyses = await prisma.feedbackAnalysis.count();

  return NextResponse.json({
    totals: {
      analyses: totalAnalyses,
      sentiment: Object.fromEntries(
        sentimentGroups.map((g) => [g.sentiment, g._count._all])
      ),
      status: Object.fromEntries(
        statusGroups.map((g) => [g.status, g._count._all])
      ),
    },
    severityDistribution: severityGroups.map((g) => ({
      severity: g.severityScore,
      count: g._count._all,
    })),
    topicDistribution: Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
    sentimentTrend: days,
    highSeverity,
  });
}
