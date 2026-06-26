"use client";

import { useEffect, useState } from "react";
import type { EmergingTrend } from "@/lib/emerging-trends";

type Status = "loading" | "error" | "ready";

export function EmergingTrends() {
  const [trends, setTrends] = useState<EmergingTrend[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/trends/emerging?windowDays=7");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setTrends(data.trends ?? []);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load trends");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Emerging Trends</h2>
        <p className="mt-2 text-sm text-slate-400">Loading trends…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Emerging Trends</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (trends.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Emerging Trends</h2>
        <p className="mt-2 text-sm text-slate-400">No trend data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Emerging Trends</h2>
      <ul className="mt-3 space-y-2">
        {trends.map((t) => {
          const arrow =
            t.trend === "rising" ? (
              <span aria-label="rising" title="rising" className="text-green-600">
                ▲
              </span>
            ) : t.trend === "declining" ? (
              <span aria-label="declining" title="declining" className="text-red-600">
                ▼
              </span>
            ) : (
              <span aria-label="stable" title="stable" className="text-slate-400">
                —
              </span>
            );
          const pctLabel = Number.isFinite(t.growthRate)
            ? `${t.growthRate > 0 ? "+" : ""}${t.growthRate.toFixed(0)}%`
            : "New";
          const pctColor =
            t.trend === "rising"
              ? "text-green-600"
              : t.trend === "declining"
              ? "text-red-600"
              : "text-slate-500";
          return (
            <li
              key={t.topic}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-slate-700">
                {arrow}
                <span className="font-medium">{t.topic}</span>
                <span className="text-slate-400">
                  {t.currentCount} vs {t.previousCount}
                </span>
              </span>
              <span className={`font-medium ${pctColor}`}>{pctLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
