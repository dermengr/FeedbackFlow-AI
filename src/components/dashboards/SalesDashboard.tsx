"use client";

import { useMemo } from "react";
import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";

import { FunnelChart } from "@/components/FunnelChart";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { ComparisonView } from "@/components/ComparisonView";
import { RisingTopics } from "@/components/RisingTopics";
import { RealtimeStats } from "@/components/RealtimeStats";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";

const SALES_KEYWORDS = [
  "pricing",
  "purchase",
  "checkout",
  "payment",
  "discount",
  "sale",
  "deal",
  "order",
  "billing",
  "refund",
  "upgrade",
  "renewal",
  "contract",
  "quote",
  "proposal",
  "lead",
  "demo",
  "trial",
  "conversion",
  "pipeline",
  "revenue",
];

function isSalesTopic(topic: string): boolean {
  const t = topic.toLowerCase();
  return SALES_KEYWORDS.some((kw) => t.includes(kw));
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodDates() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = 14;
  const msPerDay = 24 * 60 * 60 * 1000;
  const p2End = today;
  const p2Start = new Date(today.getTime() - days * msPerDay);
  const p1End = p2Start;
  const p1Start = new Date(p1End.getTime() - days * msPerDay);
  return {
    p1Start: formatIsoDate(p1Start),
    p1End: formatIsoDate(p1End),
    p2Start: formatIsoDate(p2Start),
    p2End: formatIsoDate(p2End),
  };
}

export function SalesDashboard({
  sentimentData,
  topicDistribution,
  sentimentTrend,
  highSeverity,
  totalAnalyses,
  positive,
  negative,
  highSeverityCount,
}: RoleDashboardProps) {
  const salesTopics = useMemo(
    () => topicDistribution.filter((t) => isSalesTopic(t.topic)),
    [topicDistribution]
  );

  const periodDates = useMemo(() => getPeriodDates(), []);

  return (
    <DashboardContainer className="space-y-6">
      <DashboardHeader title="Sales" />

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
        <Card title="Conversion funnel">
          <FunnelChart />
        </Card>

        <Card title="Customer sentiment">
          {sentimentData.length > 0 ? (
            <SentimentDonutChart data={sentimentData} />
          ) : (
            <EmptyState message="No sentiment data yet." />
          )}
        </Card>

        <Card title="Feedback volume">
          <FeedbackTimeline />
        </Card>

        <Card title="Sales topic distribution">
          {salesTopics.length > 0 ? (
            <TopicDistributionChart data={salesTopics} />
          ) : (
            <EmptyState message="No sales-related topics found." />
          )}
        </Card>

        <Card title="Rising topics">
          <RisingTopics />
        </Card>

        <Card title="Sentiment trend (14 days)">
          {sentimentTrend.length > 0 ? (
            <SentimentTrendChart data={sentimentTrend} />
          ) : (
            <EmptyState message="No trend data yet." />
          )}
        </Card>

        <Card title="Sentiment heatmap">
          <SentimentHeatmap />
        </Card>

        <Card title="Period comparison">
          <ComparisonView
            mode="period"
            {...periodDates}
            label1="Previous 14 days"
            label2="Last 14 days"
          />
        </Card>
      </div>

      <Card title="High-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
