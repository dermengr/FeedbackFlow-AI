"use client";

import { useEffect, useState } from "react";

interface VolumeAnomaly {
  date: string;
  count: number;
  expected: number;
  deviation: number;
}

interface SentimentAnomaly {
  date: string;
  negativeRate: number;
  expectedRate: number;
  deviation: number;
}

interface AnomalySummary {
  totalAnomalies: number;
  lastAnomalyDate: string | null;
}

interface AnomalyData {
  volumeAnomalies: VolumeAnomaly[];
  sentimentAnomalies: SentimentAnomaly[];
  summary: AnomalySummary;
  days?: number;
}

type Status = "loading" | "error" | "ready";

export function AnomalyAlerts({ days = 30 }: { days?: number }) {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/anomalies?days=${days}`);
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const json = (await res.json()) as AnomalyData;
        if (cancelled) return;
        setData(json);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load anomalies");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days]);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Anomaly Alerts</h2>
        <p className="mt-2 text-sm text-slate-400">Loading anomalies…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Anomaly Alerts</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  const total = data?.summary.totalAnomalies ?? 0;
  const volume = data?.volumeAnomalies ?? [];
  const sentiment = data?.sentimentAnomalies ?? [];
  const hasAnomalies = total > 0 && (volume.length > 0 || sentiment.length > 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Anomaly Alerts</h2>
        <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
          {total} {total === 1 ? "anomaly" : "anomalies"}
        </span>
      </div>

      {!hasAnomalies ? (
        <p className="mt-3 text-sm text-slate-400">No anomalies detected</p>
      ) : (
        <div className="mt-3 space-y-3">
          {volume.map((a) => (
            <div
              key={`v-${a.date}`}
              className="rounded-md border border-red-200 bg-red-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-red-700">
                  Volume spike
                </span>
                <span className="text-xs text-red-500">{a.date}</span>
              </div>
              <p className="mt-1 text-sm text-red-800">
                {a.count} items vs {a.expected} expected
              </p>
              <p className="text-xs text-red-500">
                Deviation: +{a.deviation}
              </p>
            </div>
          ))}

          {sentiment.map((a) => (
            <div
              key={`s-${a.date}`}
              className="rounded-md border border-amber-200 bg-amber-50 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-700">
                  Sentiment shift
                </span>
                <span className="text-xs text-amber-500">{a.date}</span>
              </div>
              <p className="mt-1 text-sm text-amber-800">
                {(a.negativeRate * 100).toFixed(0)}% negative vs{" "}
                {(a.expectedRate * 100).toFixed(0)}% expected
              </p>
              <p className="text-xs text-amber-500">
                Deviation: +{(a.deviation * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      )}

      {data?.summary.lastAnomalyDate && (
        <p className="mt-3 text-xs text-slate-400">
          Last anomaly: {data.summary.lastAnomalyDate}
        </p>
      )}
    </div>
  );
}
