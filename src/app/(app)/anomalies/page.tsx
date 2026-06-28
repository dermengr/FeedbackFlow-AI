"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell, PageHeader, PageSection, AnimatedCard, AnimatedButton } from "@/components/PageShell";
import { showToast } from "@/lib/toast";
import type { VolumeAnomaly, SentimentAnomaly, AnomalySummary } from "@/lib/anomaly";

type AnomalyData = {
  volumeAnomalies: VolumeAnomaly[];
  sentimentAnomalies: SentimentAnomaly[];
  summary: AnomalySummary;
  days: number;
};

function SummaryCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div
      className={`card-modern p-4 ${
        tone === "warning"
          ? "border-amber-200 dark:border-amber-700/50"
          : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${
          tone === "warning" ? "text-amber-600" : "text-slate-900 dark:text-slate-100"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export default function AnomaliesPage() {
  const [data, setData] = useState<AnomalyData | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/anomalies?days=${days}`, { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load anomalies: ${res.status}`);
      }
      const json = (await res.json()) as AnomalyData;
      setData(json);
    } catch (err) {
      showToast(
        "Failed to load anomalies",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const totalVolume = data?.volumeAnomalies.length ?? 0;
  const totalSentiment = data?.sentimentAnomalies.length ?? 0;
  const totalAnomalies = data?.summary.totalAnomalies ?? 0;
  const lastAnomalyDate = data?.summary.lastAnomalyDate;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Anomaly Alerts"
        description="Volume spikes and sentiment shifts detected in your feedback pipeline."
      />

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="sm:w-48">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                Window (days)
              </label>
              <input
                type="number"
                min={1}
                value={days}
                onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                className="input-modern"
              />
            </div>
            <AnimatedButton onClick={load} className="btn-primary" disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </AnimatedButton>
          </div>
        </AnimatedCard>
      </PageSection>

      <PageSection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard
            label="Total Anomalies"
            value={String(totalAnomalies)}
            hint={`Over last ${data?.days ?? days} days`}
            tone={totalAnomalies > 0 ? "warning" : "neutral"}
          />
          <SummaryCard
            label="Volume Spikes"
            value={String(totalVolume)}
            hint={totalVolume > 0 ? "Unusual daily counts" : "No volume spikes"}
            tone={totalVolume > 0 ? "warning" : "neutral"}
          />
          <SummaryCard
            label="Sentiment Shifts"
            value={String(totalSentiment)}
            hint={totalSentiment > 0 ? "Negative rate spikes" : "No sentiment shifts"}
            tone={totalSentiment > 0 ? "warning" : "neutral"}
          />
        </div>
      </PageSection>

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Volume Anomalies
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {totalVolume} detected
            </span>
          </div>
          {totalVolume === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No volume anomalies detected.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-700">
                    <th className="py-1 pr-4 font-medium">Date</th>
                    <th className="py-1 pr-4 text-right font-medium">Count</th>
                    <th className="py-1 pr-4 text-right font-medium">Expected</th>
                    <th className="py-1 text-right font-medium">Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.volumeAnomalies.map((a) => (
                    <tr
                      key={a.date}
                      className="border-b border-slate-50 dark:border-slate-700/50"
                    >
                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.date}</td>
                      <td className="py-1.5 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {a.count}
                      </td>
                      <td className="py-1.5 pr-4 text-right text-slate-500 dark:text-slate-400">
                        {a.expected}
                      </td>
                      <td className="py-1.5 text-right text-sm font-semibold text-red-600">
                        +{a.deviation}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AnimatedCard>
      </PageSection>

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Sentiment Anomalies
            </h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {totalSentiment} detected
            </span>
          </div>
          {totalSentiment === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No sentiment anomalies detected.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-700">
                    <th className="py-1 pr-4 font-medium">Date</th>
                    <th className="py-1 pr-4 text-right font-medium">Negative Rate</th>
                    <th className="py-1 pr-4 text-right font-medium">Expected</th>
                    <th className="py-1 text-right font-medium">Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.sentimentAnomalies.map((a) => (
                    <tr
                      key={a.date}
                      className="border-b border-slate-50 dark:border-slate-700/50"
                    >
                      <td className="py-1.5 pr-4 text-slate-700 dark:text-slate-300">{a.date}</td>
                      <td className="py-1.5 pr-4 text-right font-medium text-slate-900 dark:text-slate-100">
                        {(a.negativeRate * 100).toFixed(0)}%
                      </td>
                      <td className="py-1.5 pr-4 text-right text-slate-500 dark:text-slate-400">
                        {(a.expectedRate * 100).toFixed(0)}%
                      </td>
                      <td className="py-1.5 text-right text-sm font-semibold text-red-600">
                        +{(a.deviation * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lastAnomalyDate && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Last anomaly: {lastAnomalyDate}
            </p>
          )}
        </AnimatedCard>
      </PageSection>
    </PageShell>
  );
}
