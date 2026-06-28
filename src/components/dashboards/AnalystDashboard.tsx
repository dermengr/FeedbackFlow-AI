"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { InsightsPanel } from "@/components/InsightsPanel";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";
import { RealtimeStats } from "@/components/RealtimeStats";
import { ComparisonView } from "@/components/ComparisonView";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { WidgetGrid } from "@/components/WidgetGrid";

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodRanges() {
  const now = new Date();
  const p2End = new Date(now);
  const p2Start = new Date(now);
  p2Start.setDate(p2Start.getDate() - 7);
  const p1End = new Date(p2Start);
  p1End.setDate(p1End.getDate() - 1);
  const p1Start = new Date(p1End);
  p1Start.setDate(p1Start.getDate() - 6);
  return {
    p1Start: formatIsoDate(p1Start),
    p1End: formatIsoDate(p1End),
    p2Start: formatIsoDate(p2Start),
    p2End: formatIsoDate(p2End),
  };
}

export function AnalystDashboard({
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
  const periodRanges = getPeriodRanges();

  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader title="Analyst" />

      <RealtimeStats />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
      </div>

      <InsightsPanel timeRange="7d" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={sentimentTrend} />
        </Card>

        <Card title="Sentiment distribution">
          {sentimentData.length ? (
            <SentimentDonutChart data={sentimentData} />
          ) : (
            <EmptyState message="No sentiment data yet." />
          )}
        </Card>

        <Card title="Topic distribution">
          {topicDistribution.length ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No topic data yet." />
          )}
        </Card>

        <Card title="Severity distribution">
          <SeverityChart data={severityData} />
        </Card>

        <Card title="Emotion distribution">
          {emotionData.length ? (
            <EmotionDonutChart data={emotionData} />
          ) : (
            <EmptyState message="No emotion data yet." />
          )}
        </Card>

        <Card title="Sentiment heatmap">
          <SentimentHeatmap />
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
        </Card>

        <Card title="Emerging trends">
          <EmergingTrends />
        </Card>

        <Card title="Topic correlations">
          <TopicCorrelation />
        </Card>

        <Card title="Source health">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Source health available on the Sources page.</p>
          </div>
        </Card>
      </div>

      <Card title="Period comparison (last 7 days vs previous 7 days)">
        <ComparisonView
          mode="period"
          p1Start={periodRanges.p1Start}
          p1End={periodRanges.p1End}
          p2Start={periodRanges.p2Start}
          p2End={periodRanges.p2End}
          label1="Previous 7 days"
          label2="Last 7 days"
        />
      </Card>

      <Card title="Activity timeline">
        <FeedbackTimeline />
      </Card>

      <Card title="Custom widgets">
        <WidgetGrid />
      </Card>

      <Card title="High-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
