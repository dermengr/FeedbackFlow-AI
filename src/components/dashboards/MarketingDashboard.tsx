"use client";

import { useMemo } from "react";
import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";

import { InsightsPanel } from "@/components/InsightsPanel";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { ComparisonView } from "@/components/ComparisonView";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { SeverityChart } from "@/components/charts/SeverityChart";

function useComparisonDates() {
  return useMemo(() => {
    const now = new Date();
    const toDateString = (d: Date) => d.toISOString().slice(0, 10);
    const msPerDay = 24 * 60 * 60 * 1000;

    const p2End = now;
    const p2Start = new Date(now.getTime() - 14 * msPerDay);
    const p1End = new Date(p2Start.getTime() - msPerDay);
    const p1Start = new Date(p1End.getTime() - 14 * msPerDay);

    return {
      p1Start: toDateString(p1Start),
      p1End: toDateString(p1End),
      p2Start: toDateString(p2Start),
      p2End: toDateString(p2End),
    };
  }, []);
}

export function MarketingDashboard({
  sentimentData,
  severityData,
  topicDistribution,
  sentimentTrend,
  highSeverity,
  totalAnalyses,
  positive,
  negative,
  highSeverityCount,
}: RoleDashboardProps) {
  const comparisonDates = useComparisonDates();

  const hasSentimentData = sentimentData.length > 0;
  const hasSentimentTrend = sentimentTrend.length > 0;
  const hasTopicDistribution = topicDistribution.length > 0;

  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader
        title="Marketing"
        description="Customer sentiment, brand topics, and campaign feedback."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard
          label="High severity"
          value={highSeverityCount}
          accent="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsPanel timeRange="30d" />

        <Card title="Customer sentiment">
          {hasSentimentData ? (
            <SentimentDonutChart data={sentimentData} />
          ) : (
            <EmptyState message="No sentiment data available." />
          )}
        </Card>

        <Card title="Sentiment trend">
          {hasSentimentTrend ? (
            <SentimentTrendChart data={sentimentTrend} />
          ) : (
            <EmptyState message="No trend data available." />
          )}
        </Card>

        <Card title="Brand topic distribution">
          {hasTopicDistribution ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No topic data available." />
          )}
        </Card>

        <Card title="Feedback volume">
          <FeedbackTimeline />
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
        </Card>

        <Card title="Emerging trends">
          <EmergingTrends />
        </Card>

        <Card title="Severity distribution">
          <SeverityChart data={severityData} />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="lg:col-span-2">
          <Card title="Sentiment heatmap">
            <SentimentHeatmap />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Topic correlations">
            <TopicCorrelation />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Period comparison">
            <ComparisonView mode="period" {...comparisonDates} />
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="High-severity feedback">
            <HighSeverityList items={highSeverity} />
          </Card>
        </div>
      </div>
    </DashboardContainer>
  );
}
