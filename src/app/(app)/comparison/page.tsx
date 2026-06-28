"use client";

import { useState, useCallback } from "react";
import { PageShell, PageHeader, PageSection, AnimatedCard, AnimatedButton } from "@/components/PageShell";
import { showToast } from "@/lib/toast";
import type { PeriodStats, ComparisonDeltas } from "@/lib/comparison";

type ComparisonMode = "period" | "source";

type ComparisonData = {
  type: ComparisonMode;
  period1: PeriodStats;
  period2: PeriodStats;
  deltas: ComparisonDeltas;
  source1?: string;
  source2?: string;
  days?: number;
};

function toIsoLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function startOfDay(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function DeltaIndicator({
  value,
  higherIsBetter = true,
  suffix = "",
}: {
  value: number;
  higherIsBetter?: boolean;
  suffix?: string;
}) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <span aria-hidden>→</span>0{suffix}
      </span>
    );
  }
  const isUp = value > 0;
  const favorable = higherIsBetter ? isUp : !isUp;
  const arrow = isUp ? "↑" : "↓";
  const sign = isUp ? "+" : "";
  const color = favorable ? "text-green-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <span aria-hidden>{arrow}</span>
      {sign}
      {value}
      {suffix}
    </span>
  );
}

function SentimentBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="capitalize text-slate-600 dark:text-slate-400">{label}</span>
        <span className="text-slate-500 dark:text-slate-400">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label} sentiment`}
        />
      </div>
    </div>
  );
}

function PeriodColumn({ title, subtitle, stats }: { title: string; subtitle?: string; stats: PeriodStats }) {
  const sentiments: { key: keyof PeriodStats["sentimentDistribution"]; color: string }[] = [
    { key: "positive", color: "bg-green-500" },
    { key: "neutral", color: "bg-slate-400" },
    { key: "negative", color: "bg-red-500" },
  ];
  return (
    <div className="card-modern flex-1 p-4">
      <div className="border-b border-slate-100 pb-3 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Total Items
        </span>
        <span className="text-2xl font-bold text-brand-600">{stats.totalItems}</span>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Sentiment
        </p>
        <div className="mt-2 space-y-2">
          {sentiments.map(({ key, color }) => (
            <SentimentBar key={key} label={key} pct={stats.sentimentDistribution[key]} color={color} />
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Avg Severity
        </span>
        <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          {stats.avgSeverity.toFixed(2)}
          <span className="ml-1 text-xs font-normal text-slate-400">/ 5</span>
        </span>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Top Topics
        </p>
        {stats.topTopics.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No topics detected.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {stats.topTopics.map((t) => (
              <li key={t.topic} className="flex items-center justify-between text-sm">
                <span className="truncate text-slate-700 dark:text-slate-300">{t.topic}</span>
                <span className="ml-2 shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:bg-brand-900/30 dark:text-brand-300">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-700">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Status
        </p>
        {Object.keys(stats.statusDistribution).length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No status data.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(stats.statusDistribution).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              >
                {status}
                <span className="text-slate-400 dark:text-slate-500">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const [mode, setMode] = useState<ComparisonMode>("period");

  const [p1Start, setP1Start] = useState(toIsoLocal(startOfDay(14)));
  const [p1End, setP1End] = useState(toIsoLocal(endOfDay()));
  const [p2Start, setP2Start] = useState(toIsoLocal(startOfDay(28)));
  const [p2End, setP2End] = useState(toIsoLocal(startOfDay(15)));

  const [source1, setSource1] = useState("");
  const [source2, setSource2] = useState("");
  const [days, setDays] = useState(30);

  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (mode === "period") {
      params.set("type", "period");
      params.set("p1Start", new Date(p1Start).toISOString());
      params.set("p1End", new Date(p1End).toISOString());
      params.set("p2Start", new Date(p2Start).toISOString());
      params.set("p2End", new Date(p2End).toISOString());
    } else {
      params.set("type", "source");
      params.set("source1", source1);
      params.set("source2", source2);
      params.set("days", String(days));
    }
    return `/api/comparison?${params.toString()}`;
  }, [mode, p1Start, p1End, p2Start, p2End, source1, source2, days]);

  async function handleCompare() {
    if (mode === "source" && (!source1.trim() || !source2.trim())) {
      showToast("Enter both source names", "warning");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(buildUrl(), { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Comparison failed: ${res.status}`);
      }
      const json = (await res.json()) as ComparisonData;
      setData(json);
    } catch (err) {
      showToast(
        "Failed to load comparison",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }

  const col1Title = mode === "source" ? source1 || "Source 1" : "Period 1";
  const col2Title = mode === "source" ? source2 || "Source 2" : "Period 2";
  const col1Subtitle =
    mode === "source"
      ? `Last ${days} days`
      : p1Start && p1End
      ? `${p1Start.slice(0, 10)} → ${p1End.slice(0, 10)}`
      : undefined;
  const col2Subtitle =
    mode === "source"
      ? `Last ${days} days`
      : p2Start && p2End
      ? `${p2Start.slice(0, 10)} → ${p2End.slice(0, 10)}`
      : undefined;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Comparison View"
        description="Compare feedback metrics across two time periods or two sources."
      />

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setMode("period")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "period"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Period
            </button>
            <button
              type="button"
              onClick={() => setMode("source")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                mode === "source"
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              Source
            </button>
          </div>

          {mode === "period" ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Period 1 start
                </label>
                <input
                  type="datetime-local"
                  value={p1Start}
                  onChange={(e) => setP1Start(e.target.value)}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Period 1 end
                </label>
                <input
                  type="datetime-local"
                  value={p1End}
                  onChange={(e) => setP1End(e.target.value)}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Period 2 start
                </label>
                <input
                  type="datetime-local"
                  value={p2Start}
                  onChange={(e) => setP2Start(e.target.value)}
                  className="input-modern"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Period 2 end
                </label>
                <input
                  type="datetime-local"
                  value={p2End}
                  onChange={(e) => setP2End(e.target.value)}
                  className="input-modern"
                />
              </div>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Source 1
                </label>
                <input
                  type="text"
                  value={source1}
                  onChange={(e) => setSource1(e.target.value)}
                  placeholder="e.g. GitHubIssues"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Source 2
                </label>
                <input
                  type="text"
                  value={source2}
                  onChange={(e) => setSource2(e.target.value)}
                  placeholder="e.g. Trustpilot"
                  className="input-modern"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                  Days
                </label>
                <input
                  type="number"
                  min={1}
                  value={days}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                  className="input-modern"
                />
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <AnimatedButton onClick={handleCompare} className="btn-primary" disabled={loading}>
              {loading ? "Comparing…" : "Compare"}
            </AnimatedButton>
          </div>
        </AnimatedCard>
      </PageSection>

      {data && (
        <PageSection>
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-start">
            <PeriodColumn title={col1Title} subtitle={col1Subtitle} stats={data.period1} />

            <div className="flex shrink-0 flex-row items-center justify-around gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50 md:w-44 md:flex-col md:justify-start">
              <p className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 md:block">
                Delta
              </p>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Items
                </span>
                <DeltaIndicator value={data.deltas.totalItems} higherIsBetter />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Pos. Rate
                </span>
                <DeltaIndicator value={data.deltas.positiveRate} higherIsBetter suffix="pp" />
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Severity
                </span>
                <DeltaIndicator value={data.deltas.avgSeverity} higherIsBetter={false} />
              </div>
            </div>

            <PeriodColumn title={col2Title} subtitle={col2Subtitle} stats={data.period2} />
          </div>

          {data.deltas.topTopics.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Topic Deltas
              </h3>
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-700">
                    <th className="py-1 pr-4 font-medium">Topic</th>
                    <th className="py-1 pr-4 text-right font-medium">{col1Title}</th>
                    <th className="py-1 pr-4 text-right font-medium">{col2Title}</th>
                    <th className="py-1 text-right font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deltas.topTopics.map((t) => (
                    <tr key={t.topic} className="border-b border-slate-50 dark:border-slate-700/50">
                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{t.topic}</td>
                      <td className="py-1.5 pr-4 text-right text-slate-500 dark:text-slate-400">
                        {t.p1Count}
                      </td>
                      <td className="py-1.5 pr-4 text-right text-slate-500 dark:text-slate-400">
                        {t.p2Count}
                      </td>
                      <td className="py-1.5 text-right">
                        <DeltaIndicator value={t.delta} higherIsBetter />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PageSection>
      )}
    </PageShell>
  );
}
