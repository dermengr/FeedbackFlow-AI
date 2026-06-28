"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";

import { InsightsPanel } from "@/components/InsightsPanel";
import { RealtimeStats } from "@/components/RealtimeStats";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";
import { FunnelChart } from "@/components/FunnelChart";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { ComparisonView } from "@/components/ComparisonView";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";

const FEATURE_REQUEST_TOPIC_KEYS = [
  "feature",
  "request",
  "enhancement",
  "suggestion",
  "wish",
  "idea",
  "product",
  "roadmap",
];

function getFeatureRequestDistribution(
  topicDistribution: RoleDashboardProps["topicDistribution"]
) {
  return topicDistribution.filter((t) =>
    FEATURE_REQUEST_TOPIC_KEYS.some((key) =>
      t.topic.toLowerCase().includes(key)
    )
  );
}

export function ProductOwnerDashboard({
  totalAnalyses,
  positive,
  negative,
  neutral,
  highSeverityCount,
  highSeverity,
  sentimentData,
  severityData,
  emotionData,
  topicDistribution,
  sentimentTrend,
}: RoleDashboardProps) {
  const featureRequestTopics = getFeatureRequestDistribution(topicDistribution);
  const hasFeatureRequestTopics = featureRequestTopics.length > 0;
  const hasTopicDistribution = topicDistribution.length > 0;
  const hasSentiment = sentimentData.length > 0;
  const hasEmotion = emotionData.length > 0;
  const hasSeverity = severityData.length > 0;
  const hasTrend = sentimentTrend.length > 0;

  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader
        title="Product Owner"
        description="Product insights dashboard"
      />

      <RealtimeStats />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard
          label="High severity (≥4)"
          value={highSeverityCount}
          accent="text-orange-600"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <InsightsPanel />
        </div>

        <Card title="Feedback volume (14 days)">
          {hasTrend ? (
            <SentimentTrendChart data={sentimentTrend} />
          ) : (
            <EmptyState message="No feedback volume data yet." />
          )}
        </Card>

        <Card title="Sentiment distribution">
          {hasSentiment ? (
            <SentimentDonutChart data={sentimentData} />
          ) : (
            <EmptyState message="No sentiment data yet." />
          )}
        </Card>

        <Card title="Feature-request topic distribution">
          {hasFeatureRequestTopics ? (
            <TopicDistributionChart data={featureRequestTopics} />
          ) : (
            <EmptyState message="No feature-request topics detected." />
          )}
        </Card>

        <Card title="Topic distribution">
          {hasTopicDistribution ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No topic data yet." />
          )}
        </Card>

        <Card title="Severity distribution">
          {hasSeverity ? (
            <SeverityChart data={severityData} />
          ) : (
            <EmptyState message="No severity data yet." />
          )}
        </Card>

        <Card title="Emotion distribution">
          {hasEmotion ? (
            <EmotionDonutChart data={emotionData} />
          ) : (
            <EmptyState message="No emotion data yet." />
          )}
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
        </Card>

        <Card title="Emerging trends">
          <EmergingTrends />
        </Card>

        <Card title="Triage funnel">
          <FunnelChart />
        </Card>

        <Card title="Topic correlations">
          <TopicCorrelation />
        </Card>

        <Card title="Period comparison">
          <ComparisonView />
        </Card>
      </div>

      <Card title="Activity timeline">
        <FeedbackTimeline />
      </Card>

      <Card title="Recent high-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
