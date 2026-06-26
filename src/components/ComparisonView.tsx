"use client";

import { useEffect, useState, useCallback } from "react";
import type {
  PeriodStats,
  ComparisonDeltas,
  ComparisonResult,
  SourceComparisonResult,
} from "@/lib/comparison";

type Status = "loading" | "error" | "ready";

// Union of the two API response shapes. Both carry period1/period2/deltas;
// the source variant additionally carries source1/source2/days.
type ComparisonData = ComparisonResult | SourceComparisonResult;

export type ComparisonMode = "period" | "source";

export interface ComparisonViewProps {
  mode?: ComparisonMode;
  // Period mode params (ISO 8601 strings).
  p1Start?: string;
  p1End?: string;
  p2Start?: string;
  p2End?: string;
  // Source mode params.
  source1?: string;
  source2?: string;
  days?: number;
  // Optional labels for the two columns. Defaults derived from mode/params.
  label1?: string;
  label2?: string;
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

interface DeltaIndicatorProps {
  value: number;
  // When true, a higher value is "good" (e.g. positive rate). When false,
  // a higher value is "bad" (e.g. avg severity). Controls coloring.
  higherIsBetter?: boolean;
  suffix?: string;
}

// Renders an arrow + colored delta. Green when the change is favorable,
// red when unfavorable, slate when zero.
function DeltaIndicator({ value, higherIsBetter = true, suffix = "" }: DeltaIndicatorProps) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
        <span aria-hidden>→</span>
        0{suffix}
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

interface SentimentBarProps {
  label: string;
  pct: number;
  color: string;
}

function SentimentBar({ label, pct, color }: SentimentBarProps) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="capitalize text-slate-600">{label}</span>
        <span className="text-slate-500">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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

interface PeriodColumnProps {
  title: string;
  subtitle?: string;
  stats: PeriodStats;
}

// A single side of the comparison: total items, sentiment breakdown,
// avg severity, and top topics.
function PeriodColumn({ title, subtitle, stats }: PeriodColumnProps) {
  const sentiments: { key: keyof PeriodStats["sentimentDistribution"]; color: string }[] = [
    { key: "positive", color: "bg-green-500" },
    { key: "neutral", color: "bg-slate-400" },
    { key: "negative", color: "bg-red-500" },
  ];

  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>

      {/* Total items */}
      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Total Items
        </span>
        <span className="text-2xl font-bold text-indigo-600">{stats.totalItems}</span>
      </div>

      {/* Sentiment breakdown */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Sentiment
        </p>
        <div className="mt-2 space-y-2">
          {sentiments.map(({ key, color }) => (
            <SentimentBar
              key={key}
              label={key}
              pct={stats.sentimentDistribution[key]}
              color={color}
            />
          ))}
        </div>
      </div>

      {/* Avg severity */}
      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Avg Severity
        </span>
        <span className="text-lg font-semibold text-slate-700">
          {stats.avgSeverity.toFixed(2)}
          <span className="ml-1 text-xs font-normal text-slate-400">/ 5</span>
        </span>
      </div>

      {/* Top topics */}
      <div className="mt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Top Topics
        </p>
        {stats.topTopics.length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No topics detected.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {stats.topTopics.map((t) => (
              <li
                key={t.topic}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate text-slate-700">{t.topic}</span>
                <span className="ml-2 shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-600">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Status distribution */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Status
        </p>
        {Object.keys(stats.statusDistribution).length === 0 ? (
          <p className="mt-2 text-xs text-slate-400">No status data.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(stats.statusDistribution).map(([status, count]) => (
              <span
                key={status}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
              >
                {status}
                <span className="text-slate-400">{count}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ComparisonView({
  mode = "period",
  p1Start,
  p1End,
  p2Start,
  p2End,
  source1,
  source2,
  days = 30,
  label1,
  label2,
}: ComparisonViewProps) {
  const [data, setData] = useState<ComparisonData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (mode === "period") {
      params.set("type", "period");
      params.set("p1Start", p1Start ?? "");
      params.set("p1End", p1End ?? "");
      params.set("p2Start", p2Start ?? "");
      params.set("p2End", p2End ?? "");
    } else {
      params.set("type", "source");
      params.set("source1", source1 ?? "");
      params.set("source2", source2 ?? "");
      params.set("days", String(days));
    }
    return `/api/comparison?${params.toString()}`;
  }, [mode, p1Start, p1End, p2Start, p2End, source1, source2, days]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch(buildUrl(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const json = (await res.json()) as ComparisonData;
        if (cancelled) return;
        setData(json);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load comparison");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [buildUrl]);

  // Derive column titles from the mode / params / response.
  const isSource = mode === "source";
  const col1Title = label1 ?? (isSource ? source1 ?? "Source 1" : "Period 1");
  const col2Title = label2 ?? (isSource ? source2 ?? "Source 2" : "Period 2");
  const col1Subtitle = isSource
    ? `Last ${days} days`
    : p1Start && p1End
    ? `${p1Start.slice(0, 10)} → ${p1End.slice(0, 10)}`
    : undefined;
  const col2Subtitle = isSource
    ? `Last ${days} days`
    : p2Start && p2End
    ? `${p2Start.slice(0, 10)} → ${p2End.slice(0, 10)}`
    : undefined;

  const heading = isSource
    ? "Source Comparison"
    : "Period Comparison";

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">{heading}</h2>
        <p className="mt-2 text-sm text-slate-400">Loading comparison…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">{heading}</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">{heading}</h2>
        <p className="mt-2 text-sm text-slate-400">No comparison data available.</p>
      </div>
    );
  }

  const deltas: ComparisonDeltas = data.deltas;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{heading}</h2>
        {isSource && (
          <span className="text-xs text-slate-400">Last {days} days</span>
        )}
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 md:flex-row md:items-start">
        <PeriodColumn
          title={col1Title}
          subtitle={col1Subtitle}
          stats={data.period1}
        />

        {/* Delta column — sits between the two period columns on desktop,
            below them on mobile. */}
        <div className="flex shrink-0 flex-row items-center justify-around gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 md:w-44 md:flex-col md:justify-start">
          <p className="hidden text-xs font-semibold uppercase tracking-wide text-slate-500 md:block">
            Delta
          </p>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Items
            </span>
            <DeltaIndicator value={deltas.totalItems} higherIsBetter />
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Pos. Rate
            </span>
            <DeltaIndicator
              value={deltas.positiveRate}
              higherIsBetter
              suffix="pp"
            />
          </div>

          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-slate-400">
              Severity
            </span>
            <DeltaIndicator
              value={deltas.avgSeverity}
              higherIsBetter={false}
            />
          </div>
        </div>

        <PeriodColumn
          title={col2Title}
          subtitle={col2Subtitle}
          stats={data.period2}
        />
      </div>

      {/* Topic deltas — full-width table below the columns. */}
      {deltas.topTopics.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Topic Deltas
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-1 pr-4 font-medium">Topic</th>
                  <th className="py-1 pr-4 text-right font-medium">{col1Title}</th>
                  <th className="py-1 pr-4 text-right font-medium">{col2Title}</th>
                  <th className="py-1 text-right font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {deltas.topTopics.map((t) => (
                  <tr key={t.topic} className="border-b border-slate-50">
                    <td className="py-1.5 pr-4 text-slate-700">{t.topic}</td>
                    <td className="py-1.5 pr-4 text-right text-slate-500">
                      {t.p1Count}
                    </td>
                    <td className="py-1.5 pr-4 text-right text-slate-500">
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
        </div>
      )}
    </div>
  );
}

export default ComparisonView;
