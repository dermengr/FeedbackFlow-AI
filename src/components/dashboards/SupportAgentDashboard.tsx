"use client";

import Link from "next/link";
import type { RoleDashboardProps } from "./types";
import { Card, KpiCard, EmptyState, HighSeverityList } from "./shared";
import { DashboardContainer, DashboardHeader } from "./DashboardContainer";
import { RealtimeStats } from "@/components/RealtimeStats";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { ActionItems } from "@/components/ActionItems";

export function SupportAgentDashboard({
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
        title="Support Agent"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/inbox"
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
            >
              Open Inbox
            </Link>
            <Link
              href="/inbox?filter=unassigned"
              className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Unassigned
            </Link>
          </div>
        }
      />

      <RealtimeStats />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total feedback" value={totalAnalyses} />
        <KpiCard label="Open tickets" value={negative + neutral} accent="text-amber-600" />
        <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
        <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Triage funnel">
          <FunnelChart />
        </Card>

        <Card title="Sentiment trend (14 days)">
          {sentimentTrend.length ? (
            <SentimentTrendChart data={sentimentTrend} />
          ) : (
            <EmptyState message="No sentiment trend data yet." />
          )}
        </Card>

        <Card title="Routing overview">
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <p>Routing rules and assignment logic are available on the Routing page.</p>
            <Link
              href="/routing"
              className="text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View routing rules →
            </Link>
          </div>
        </Card>

        <Card title="Assigned & open tickets">
          <div className="flex h-[260px] flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <p>Ticket assignments and queue status are managed in the Inbox.</p>
            <Link
              href="/inbox"
              className="text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Go to inbox →
            </Link>
          </div>
        </Card>
      </div>

      <Card title="Activity timeline">
        <FeedbackTimeline />
      </Card>

      <Card title="Quick action items">
        <ActionItems
          items={[
            "Acknowledge new high-severity tickets within 15 minutes",
            "Route unassigned negative feedback to the support team",
            "Follow up on tickets stuck in the Acknowledged stage",
            "Update reply templates for common billing questions",
          ]}
        />
      </Card>

      <Card title="High-severity feedback">
        <HighSeverityList items={highSeverity} />
      </Card>
    </DashboardContainer>
  );
}
