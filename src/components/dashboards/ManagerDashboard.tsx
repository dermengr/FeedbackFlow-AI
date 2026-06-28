"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { RealtimeStats } from "@/components/RealtimeStats";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AnomalyAlerts } from "@/components/AnomalyAlerts";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { ComparisonView } from "@/components/ComparisonView";
import { WidgetGrid } from "@/components/WidgetGrid";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";

export function ManagerDashboard({
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
  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader
        title="Manager Dashboard"
        badge="Manager"
        description="Real-time oversight, team routing, and emerging trends."
      />

      <RealtimeStats />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsPanel timeRange="7d" />
        <AnomalyAlerts days={30} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={sentimentTrend} />
        </Card>

        <Card title="Sentiment distribution">
          <SentimentDonutChart data={sentimentData} />
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

        {emotionData.length > 0 && (
          <Card title="Emotion distribution">
            <EmotionDonutChart data={emotionData} />
          </Card>
        )}

        <Card title="Rising topics">
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

        <Card title="Period comparison">
          <ComparisonView />
        </Card>

        <Card title="Team performance">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Team metrics available on the Team page.</p>
          </div>
        </Card>

        <Card title="Routing overview">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Routing rules available on the Routing page.</p>
          </div>
        </Card>
      </div>

      <Card title="Activity timeline">
        <FeedbackTimeline />
      </Card>

      <Card title="Custom widgets">
        <WidgetGrid />
      </Card>

      <Card title="Recent high-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
