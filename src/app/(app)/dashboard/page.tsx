import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RoleDashboard } from "@/components/RoleDashboard";
import { getUserRoles, type RoleName } from "@/lib/roles";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function getDashboardData() {
  const sentimentGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["sentiment"],
    _count: { _all: true },
  });

  const severityGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["severityScore"],
    _count: { _all: true },
  });

  const emotionGroups = await prisma.feedbackAnalysis.groupBy({
    by: ["emotion"],
    _count: { _all: true },
    where: { emotion: { not: null } },
  });

  const allTopics = await prisma.feedbackAnalysis.findMany({
    select: { topics: true },
  });
  const topicCounts = new Map<string, number>();
  for (const row of allTopics) {
    const arr = Array.isArray(row.topics) ? (row.topics as unknown[]) : [];
    for (const t of arr) {
      if (typeof t === "string") topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    }
  }

  const since = new Date();
  since.setDate(since.getDate() - 14);
  since.setHours(0, 0, 0, 0);
  const recentItems = await prisma.feedbackItem.findMany({
    where: { originalTimestamp: { gte: since } },
    select: { originalTimestamp: true, analysis: { select: { sentiment: true } } },
  });
  const days: { date: string; positive: number; neutral: number; negative: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({ date: d.toISOString().slice(0, 10), positive: 0, neutral: 0, negative: 0 });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const it of recentItems) {
    const key = new Date(it.originalTimestamp).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket && it.analysis?.sentiment) {
      bucket[it.analysis.sentiment as "positive" | "neutral" | "negative"]++;
    }
  }

  const [highSeverity, highSeverityCount] = await Promise.all([
    prisma.feedbackItem.findMany({
      where: { analysis: { severityScore: { gte: 4 } }, archive: null },
      include: { analysis: true },
      orderBy: { originalTimestamp: "desc" },
      take: 5,
    }),
    prisma.feedbackAnalysis.count({
      where: { severityScore: { gte: 4 }, feedbackItem: { archive: null } },
    }),
  ]);

  const totalAnalyses = await prisma.feedbackAnalysis.count();
  const lastRun = await prisma.ingestLog.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return {
    sentimentGroups,
    severityGroups,
    emotionGroups,
    topicDistribution: Array.from(topicCounts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
    sentimentTrend: days,
    highSeverity,
    highSeverityCount,
    totalAnalyses,
    lastRun,
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;
  const data = await getDashboardData();

  const sentimentData = data.sentimentGroups.map((g) => ({
    sentiment: g.sentiment,
    count: g._count._all,
  }));
  const severityData = data.severityGroups.map((g) => ({
    severity: g.severityScore,
    count: g._count._all,
  }));
  const emotionData = data.emotionGroups
    .filter((g) => g.emotion !== null)
    .map((g) => ({ emotion: g.emotion as string, count: g._count._all }));

  const positive = sentimentData.find((s) => s.sentiment === "positive")?.count ?? 0;
  const negative = sentimentData.find((s) => s.sentiment === "negative")?.count ?? 0;
  const neutral = sentimentData.find((s) => s.sentiment === "neutral")?.count ?? 0;
  const highSeverityCount = data.highSeverityCount;

  let roles: RoleName[] = [];
  if (userId) {
    roles = await getUserRoles(userId);
  }
  const primaryRole = roles[0] ?? "Viewer";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {primaryRole} Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Welcome back{session?.user?.name ? `, ${session.user.name}` : ""}. Here&apos;s the latest feedback overview.
          </p>
        </div>
        {data.lastRun && (
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            Last ingest:{" "}
            <span className="font-medium text-slate-700">{data.lastRun.status}</span>{" "}
            • {data.lastRun.itemsNew} new • {formatDate(data.lastRun.createdAt)}
          </div>
        )}
      </div>

      <RoleDashboard
        role={primaryRole}
        sentimentData={sentimentData}
        severityData={severityData}
        emotionData={emotionData}
        topicDistribution={data.topicDistribution}
        sentimentTrend={data.sentimentTrend}
        highSeverity={data.highSeverity}
        totalAnalyses={data.totalAnalyses}
        positive={positive}
        negative={negative}
        neutral={neutral}
        highSeverityCount={highSeverityCount}
      />
    </div>
  );
}
