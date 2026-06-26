"use client";

import { useEffect, useState, useCallback } from "react";
import type { InsightsResult, InsightsTimeRange } from "@/lib/insights";

type Status = "loading" | "error" | "ready";

interface ApiResponse {
  timeRange: InsightsTimeRange;
  cached: boolean;
  insights: InsightsResult;
}

interface InsightsPanelProps {
  /** Time range to fetch: "7d" | "30d" | "all". Defaults to "7d". */
  timeRange?: InsightsTimeRange;
}

export function InsightsPanel({ timeRange = "7d" }: InsightsPanelProps) {
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [cached, setCached] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch(
        `/api/insights?timeRange=${encodeURIComponent(timeRange)}`
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const data: ApiResponse = await res.json();
      setInsights(data.insights);
      setCached(data.cached);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load insights");
      setStatus("error");
    }
  }, [timeRange]);

  useEffect(() => {
    load();
  }, [load]);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            AI Insights Summary
          </h2>
          <span className="text-xs text-slate-400">Generating…</span>
        </div>
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-800">
            AI Insights Summary
          </h2>
        </div>
        <p className="mt-3 text-sm text-red-600">{errorMsg}</p>
        <button
          onClick={load}
          className="mt-3 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!insights) {
    return null;
  }

  const hasContent =
    insights.highlights.length > 0 ||
    insights.recommendations.length > 0 ||
    insights.trendingTopics.length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          AI Insights Summary
        </h2>
        <div className="flex items-center gap-2">
          {cached ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              cached
            </span>
          ) : (
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
              fresh
            </span>
          )}
          <span className="text-xs text-slate-400">{timeRange}</span>
        </div>
      </div>

      {/* Summary */}
      <p className="mt-4 text-sm leading-relaxed text-slate-700">
        {insights.summary || "No summary available."}
      </p>

      {!hasContent && (
        <p className="mt-4 text-sm text-slate-400">
          Not enough feedback data to generate detailed insights for this range.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Highlights */}
        <Card title="Highlights" accent="indigo">
          {insights.highlights.length > 0 ? (
            <ul className="space-y-2">
              {insights.highlights.map((h, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint />
          )}
        </Card>

        {/* Recommendations */}
        <Card title="Recommendations" accent="slate">
          {insights.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {insights.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint />
          )}
        </Card>

        {/* Trending topics */}
        <Card title="Trending Topics" accent="indigo">
          {insights.trendingTopics.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {insights.trendingTopics.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <EmptyHint />
          )}
        </Card>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={load}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "indigo" | "slate";
  children: React.ReactNode;
}) {
  const border =
    accent === "indigo" ? "border-indigo-100" : "border-slate-100";
  const titleColor =
    accent === "indigo" ? "text-indigo-700" : "text-slate-700";
  return (
    <div className={`rounded-lg border ${border} bg-slate-50/50 p-4`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyHint() {
  return <p className="text-sm text-slate-400">No data available.</p>;
}
