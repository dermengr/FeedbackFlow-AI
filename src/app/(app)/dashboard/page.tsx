import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";
import { RisingTopics } from "@/components/RisingTopics";
import { RealtimeStats } from "@/components/RealtimeStats";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AnomalyAlerts } from "@/components/AnomalyAlerts";
import { EmergingTrends } from "@/components/EmergingTrends";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { WidgetGrid } from "@/components/WidgetGrid";
import { ComparisonView } from "@/components/ComparisonView";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import {
  SentimentBadge,
  SeverityBadge,
  TopicChip,
} from "@/components/Badges";
import { formatDate, truncate } from "@/lib/utils";

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

  // B8: emotion distribution
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
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

      <RealtimeStats />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsPanel />
        <AnomalyAlerts />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={data.totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={data.sentimentTrend} />
        </Card>
        <Card title="Sentiment distribution">
          <SentimentDonutChart data={sentimentData} />
        </Card>
        <Card title="Topic distribution">
          {data.topicDistribution.length ? (
            <TopicDistributionChart data={data.topicDistribution} />
          ) : (
            <EmptyState />
          )}
        </Card>
        <Card title="Severity distribution">
          <SeverityChart data={severityData} />
        </Card>
        {emotionData.length > 0 && (
          <Card title="Emotion distribution">
            <EmotionDonutChart data={emotionData} />
          </Card>
        )}
        <Card title="Rising topics (week over week)">
          <RisingTopics />
        </Card>
        <Card title="Emerging trends">
          <EmergingTrends />
        </Card>
        <Card title="Triage funnel">
          <FunnelChart />
        </Card>
        <Card title="Sentiment heatmap">
          <SentimentHeatmap />
        </Card>
        <Card title="Topic correlations">
          <TopicCorrelation />
        </Card>
        <Card title="Activity timeline">
          <FeedbackTimeline />
        </Card>
        <Card title="Period comparison">
          <ComparisonView />
        </Card>
      </div>

      <Card title="Custom widgets">
        <WidgetGrid />
      </Card>

      {/* High severity list */}
      <Card title="Recent high-severity feedback">
        {data.highSeverity.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.highSeverity.map((item) => (
              <li key={item.id} className="py-3">
                <Link
                  href={`/inbox/${item.id}`}
                  className="flex flex-wrap items-center gap-2 hover:underline"
                >
                  <span className="font-medium text-slate-900">
                    {item.title ?? item.externalId}
                  </span>
                  {item.analysis && (
                    <SeverityBadge score={item.analysis.severityScore} />
                  )}
                  {item.analysis && (
                    <SentimentBadge sentiment={item.analysis.sentiment as never} />
                  )}
                </Link>
                {item.analysis?.summary && (
                  <p className="mt-1 text-sm text-slate-600">
                    {truncate(item.analysis.summary, 200)}
                  </p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {(item.analysis?.topics as string[] | undefined)?.map((t) => (
                    <TopicChip key={t} topic={t} />
                  ))}
                  <span className="ml-auto text-xs text-slate-400">
                    {formatDate(item.originalTimestamp)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
      No data yet. Run an ingest to populate the dashboard.
    </div>
  );
}
