"use client";

import Link from "next/link";
import type { RoleName } from "@/lib/roles";
import { getDashboardSections, type DashboardSection } from "@/lib/dashboard-config";
import { RealtimeStats } from "@/components/RealtimeStats";
import { InsightsPanel } from "@/components/InsightsPanel";
import { AnomalyAlerts } from "@/components/AnomalyAlerts";
import { RisingTopics } from "@/components/RisingTopics";
import { EmergingTrends } from "@/components/EmergingTrends";
import { FunnelChart } from "@/components/FunnelChart";
import { SentimentHeatmap } from "@/components/SentimentHeatmap";
import { WidgetGrid } from "@/components/WidgetGrid";
import { ComparisonView } from "@/components/ComparisonView";
import { FeedbackTimeline } from "@/components/FeedbackTimeline";
import { TopicCorrelation } from "@/components/TopicCorrelation";
import { SentimentTrendChart } from "@/components/charts/SentimentTrendChart";
import { TopicDistributionChart } from "@/components/charts/TopicDistributionChart";
import { SeverityChart } from "@/components/charts/SeverityChart";
import { SentimentDonutChart } from "@/components/charts/SentimentDonutChart";
import { EmotionDonutChart } from "@/components/charts/EmotionDonutChart";

interface SentimentGroup {
  sentiment: string;
  count: number;
}

interface SeverityGroup {
  severity: number;
  count: number;
}

interface TopicCount {
  topic: string;
  count: number;
}

interface TrendDatum {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

interface AnalysisItem {
  sentiment: string;
  severityScore: number;
  summary: string | null;
  topics: unknown;
}

interface HighSeverityItem {
  id: string;
  title: string | null;
  externalId: string;
  originalTimestamp: Date;
  analysis: AnalysisItem | null;
}

interface RoleDashboardProps {
  role: RoleName;
  sentimentData: SentimentGroup[];
  severityData: SeverityGroup[];
  emotionData: { emotion: string; count: number }[];
  topicDistribution: TopicCount[];
  sentimentTrend: TrendDatum[];
  highSeverity: HighSeverityItem[];
  totalAnalyses: number;
  positive: number;
  negative: number;
  neutral: number;
  highSeverityCount: number;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
      No data yet. Run an ingest to populate the dashboard.
    </div>
  );
}

export function RoleDashboard({
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
}: RoleDashboardProps) {
  const sections = getDashboardSections(role);
  const has = (s: DashboardSection) => sections.includes(s);

  return (
    <div className="space-y-6">
      {has("realtimeStats") && <RealtimeStats />}

      {(has("insights") || has("anomalyAlerts")) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {has("insights") && <InsightsPanel />}
          {has("anomalyAlerts") && <AnomalyAlerts />}
        </div>
      )}

      {has("kpiCards") && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <KpiCard label="Total feedback" value={totalAnalyses} />
          <KpiCard label="Positive" value={positive} accent="text-emerald-600" />
          <KpiCard label="Negative" value={negative} accent="text-rose-600" />
          <KpiCard label="High severity (≥4)" value={highSeverityCount} accent="text-orange-600" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {has("sentimentTrend") && (
          <Card title="Sentiment trend (14 days)">
            <SentimentTrendChart data={sentimentTrend} />
          </Card>
        )}
        {has("sentimentDistribution") && (
          <Card title="Sentiment distribution">
            <SentimentDonutChart data={sentimentData} />
          </Card>
        )}
        {has("topicDistribution") && (
          <Card title="Topic distribution">
            {topicDistribution.length ? (
              <TopicDistributionChart data={topicDistribution} />
            ) : (
              <EmptyState />
            )}
          </Card>
        )}
        {has("severityDistribution") && (
          <Card title="Severity distribution">
            <SeverityChart data={severityData} />
          </Card>
        )}
        {has("emotionDistribution") && emotionData.length > 0 && (
          <Card title="Emotion distribution">
            <EmotionDonutChart data={emotionData} />
          </Card>
        )}
        {has("risingTopics") && (
          <Card title="Rising topics (week over week)">
            <RisingTopics />
          </Card>
        )}
        {has("emergingTrends") && (
          <Card title="Emerging trends">
            <EmergingTrends />
          </Card>
        )}
        {has("triageFunnel") && (
          <Card title="Triage funnel">
            <FunnelChart />
          </Card>
        )}
        {has("sentimentHeatmap") && (
          <Card title="Sentiment heatmap">
            <SentimentHeatmap />
          </Card>
        )}
        {has("topicCorrelations") && (
          <Card title="Topic correlations">
            <TopicCorrelation />
          </Card>
        )}
        {has("activityTimeline") && (
          <Card title="Activity timeline">
            <FeedbackTimeline />
          </Card>
        )}
        {has("periodComparison") && (
          <Card title="Period comparison">
            <ComparisonView />
          </Card>
        )}
        {has("teamMetrics") && (
          <Card title="Team performance">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Team metrics available on the Team page.
            </div>
          </Card>
        )}
        {has("routingOverview") && (
          <Card title="Routing overview">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Routing rules available on the Routing page.
            </div>
          </Card>
        )}
        {has("healthStatus") && (
          <Card title="System health">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Health status available on the Health page.
            </div>
          </Card>
        )}
        {has("sourceHealth") && (
          <Card title="Source health">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Source health available on the Sources page.
            </div>
          </Card>
        )}
        {has("feedbackVolume") && (
          <Card title="Feedback volume">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              Volume tracking over time.
            </div>
          </Card>
        )}
        {has("conversionFunnel") && (
          <Card title="Conversion funnel">
            <FunnelChart />
          </Card>
        )}
        {has("customerSentiment") && (
          <Card title="Customer sentiment">
            <SentimentDonutChart data={sentimentData} />
          </Card>
        )}
        {has("bugSeverity") && (
          <Card title="Bug severity tracker">
            <SeverityChart data={severityData} />
          </Card>
        )}
        {has("qaMetrics") && (
          <Card title="QA metrics">
            <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
              QA quality metrics dashboard.
            </div>
          </Card>
        )}
      </div>

      {has("customWidgets") && (
        <Card title="Custom widgets">
          <WidgetGrid />
        </Card>
      )}

      {has("highSeverityList") && <HighSeverityCard items={highSeverity} />}
    </div>
  );
}

function HighSeverityCard({ items }: { items: HighSeverityItem[] }) {
  return (
    <Card title="Recent high-severity feedback">
      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <Link
                href={`/inbox/${item.id}`}
                className="flex flex-wrap items-center gap-2 hover:underline"
              >
                <span className="font-medium text-slate-900">
                  {item.title ?? item.externalId}
                </span>
                {item.analysis && (
                  <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                    Severity {item.analysis.severityScore}
                  </span>
                )}
                {item.analysis && (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      item.analysis.sentiment === "positive"
                        ? "bg-emerald-50 text-emerald-700"
                        : item.analysis.sentiment === "negative"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-50 text-slate-700"
                    }`}
                  >
                    {item.analysis.sentiment}
                  </span>
                )}
              </Link>
              {item.analysis?.summary && (
                <p className="mt-1 text-sm text-slate-600">
                  {item.analysis.summary.slice(0, 200)}
                  {item.analysis.summary.length > 200 ? "…" : ""}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(item.analysis?.topics as string[] | undefined)?.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-600"
                  >
                    {t}
                  </span>
                ))}
                <span className="ml-auto text-xs text-slate-400">
                  {new Date(item.originalTimestamp).toLocaleDateString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
