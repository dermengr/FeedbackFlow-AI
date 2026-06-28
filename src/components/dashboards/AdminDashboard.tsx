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
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { ComparisonView } from "@/components/ComparisonView";
import { WidgetGrid } from "@/components/WidgetGrid";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";

export function AdminDashboard({
  role,
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
  lastRun,
}: RoleDashboardProps) {
  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader
        title="Admin Dashboard"
        badge="Admin"
        description="System-wide overview, health, and operational intelligence."
        actions={
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Last ingest run
            </p>
            <p className="text-sm text-slate-700">
              {lastRun ? (
                <>
                  <span className="font-semibold">{lastRun.status}</span>
                  {lastRun.itemsNew >= 0 && (
                    <span className="text-slate-500">
                      {" "}
                      · {lastRun.itemsNew} new
                    </span>
                  )}
                  <span className="ml-1 text-xs text-slate-400">
                    {lastRun.createdAt.toLocaleString()}
                  </span>
                </>
              ) : (
                <span className="text-slate-400">No recent run</span>
              )}
            </p>
          </div>
        }
      />

      {/* Real-time stats */}
      <RealtimeStats />

      {/* AI insights + anomaly alerts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InsightsPanel />
        <AnomalyAlerts />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
        <KpiCard label="Neutral" value={neutral} accent="text-slate-600" />
        <KpiCard label="Negative" value={negative} accent="text-rose-600" />
        <KpiCard label="High severity" value={highSeverityCount} accent="text-orange-600" />
        <KpiCard label="Topics" value={topicDistribution.length} accent="text-indigo-600" />
      </div>

      {/* Charts & analysis modules */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Sentiment trend (14 days)">
          <SentimentTrendChart data={sentimentTrend} />
        </Card>

        <Card title="Sentiment distribution">
          <SentimentDonutChart data={sentimentData} />
        </Card>

        <Card title="Topic distribution">
          {topicDistribution.length > 0 ? (
            <TopicDistributionChart data={topicDistribution} />
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

        <Card title="Team performance">
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
            Team metrics available on the Team page.
          </div>
        </Card>

        <Card title="System health">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm text-slate-700">API status</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Operational
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm text-slate-700">Database</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Healthy
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3">
              <span className="text-sm text-slate-700">Worker queue</span>
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                Active
              </span>
            </div>
          </div>
        </Card>

        <Card title="Source health">
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
            Source health available on the Sources page.
          </div>
        </Card>
      </div>

      {/* Custom widgets */}
      <Card title="Custom widgets">
        <WidgetGrid />
      </Card>

      {/* Recent high-severity feedback */}
      <Card title="Recent high-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
