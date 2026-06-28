"use client";

import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { RealtimeStats } from "@/components/RealtimeStats";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { RisingTopics } from "@/components/RisingTopics";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";

export function DeveloperDashboard({
  sentimentData,
  severityData,
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
      <DashboardHeader title="Developer" />

      <RealtimeStats />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Bug severity tracker">
          <SeverityChart data={severityData} />
        </Card>

        <Card title="Technical topic distribution">
          {topicDistribution.length ? (
            <TopicDistributionChart data={topicDistribution} />
          ) : (
            <EmptyState message="No technical topic data yet." />
          )}
        </Card>

        <Card title="Rising technical topics">
          <RisingTopics />
        </Card>

        <Card title="Triage funnel">
          <FunnelChart />
        </Card>

        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={sentimentTrend} />
        </Card>

        <Card title="Sentiment heatmap">
          <SentimentHeatmap />
        </Card>

        <Card title="Topic correlations">
          <TopicCorrelation />
        </Card>

        <Card title="Source health">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Source health available on the Sources page.</p>
          </div>
        </Card>

        <Card title="System health">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>System health available on the Health page.</p>
          </div>
        </Card>

        <Card title="Links">
          <div className="flex h-[260px] flex-col items-center justify-center gap-2 text-sm text-slate-400">
            <p>Developer links and resources will appear here.</p>
          </div>
        </Card>
      </div>

      <Card title="Activity timeline">
        <FeedbackTimeline />
      </Card>

      <Card title="High-severity bugs">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
