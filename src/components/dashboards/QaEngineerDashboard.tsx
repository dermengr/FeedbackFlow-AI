"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { RealtimeStats } from "@/components/RealtimeStats";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { RisingTopics } from "@/components/RisingTopics";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { TopicCorrelation } from "@/components/TopicCorrelation";

export function QaEngineerDashboard({
  sentimentData,
  severityData,
  emotionData,
  topicDistribution,
  sentimentTrend,
  highSeverity,
  totalAnalyses,
  positive,
  negative,
  neutral,
  highSeverityCount,
}: RoleDashboardProps) {
  const avgSeverity =
    severityData.length > 0
      ? severityData.reduce((sum, d) => sum + d.severity * d.count, 0) /
        severityData.reduce((sum, d) => sum + d.count, 0)
      : 0;

  const negativePct =
    totalAnalyses > 0 ? Math.round((negative / totalAnalyses) * 100) : 0;

  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader title="QA Engineer" />

      <RealtimeStats />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
        <KpiCard label="Avg severity" value={Number(avgSeverity.toFixed(1))} accent="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="QA metrics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Defect density
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {totalAnalyses > 0
                  ? `${((highSeverityCount / totalAnalyses) * 100).toFixed(1)}%`
                  : "0%"}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Negative rate
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {negativePct}%
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Positive feedback
              </p>
              <p className="mt-1 text-xl font-semibold text-emerald-600">
                {positive}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Neutral feedback
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-700">
                {neutral}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Severity samples
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {severityData.reduce((sum, d) => sum + d.count, 0)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Avg severity
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900">
                {avgSeverity.toFixed(1)}
              </p>
            </div>
          </div>
        </Card>

        <Card title="Bug severity tracker">
          <SeverityChart data={severityData} />
        </Card>

        <Card title="Severity distribution">
          <SeverityChart data={severityData} />
        </Card>

        <Card title="Emotion distribution">
          {emotionData.length > 0 ? (
            <EmotionDonutChart data={emotionData} />
          ) : (
            <EmptyState message="No emotion data yet." />
          )}
        </Card>

        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={sentimentTrend} />
        </Card>

        <Card title="Topic distribution">
          {topicDistribution.length > 0 ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No topic data yet." />
          )}
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
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
      </div>

      <Card title="High-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
