"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";

export function ViewerDashboard({
  sentimentData,
  severityData,
  topicDistribution,
  sentimentTrend,
  totalAnalyses,
  positive,
  negative,
  neutral,
  highSeverityCount,
}: RoleDashboardProps) {
  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader title="Viewer" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Neutral" value={neutral} accent="text-slate-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity" value={highSeverityCount} accent="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment trend (14 days)">
          {sentimentTrend.length ? (
            <SentimentTrendChart data={sentimentTrend} />
          ) : (
            <EmptyState message="No trend data available." />
          )}
        </Card>

        <Card title="Sentiment distribution">
          {sentimentData.length ? (
            <SentimentDonutChart data={sentimentData} />
          ) : (
            <EmptyState message="No sentiment data available." />
          )}
        </Card>

        <Card title="Topic distribution">
          {topicDistribution.length ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No topic data available." />
          )}
        </Card>

        <Card title="Severity distribution">
          {severityData.length ? (
            <SeverityChart data={severityData} />
          ) : (
            <EmptyState message="No severity data available." />
          )}
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
        </Card>

        <Card title="Emerging trends">
          <EmergingTrends />
        </Card>

        <Card title="Sentiment heatmap">
          <SentimentHeatmap />
        </Card>

        <Card title="Topic correlations">
          <TopicCorrelation />
        </Card>

        <Card title="Digest">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Personalised digest available via settings.</p>
          </div>
        </Card>
      </div>
    </DashboardContainer>
  );
}
