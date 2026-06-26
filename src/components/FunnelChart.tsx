"use client";

import { useEffect, useState } from "react";
import type { FunnelData, FunnelStage } from "@/lib/funnel";

type Status = "loading" | "error" | "ready";

// Per-stage Tailwind color classes.
const STAGE_COLORS: Record<FunnelStage["name"], string> = {
  NEW: "bg-indigo-500",
  ACKNOWLEDGED: "bg-blue-500",
  ACTIONED: "bg-green-500",
};

export function FunnelChart() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/funnel?days=30");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const json = (await res.json()) as FunnelData;
        if (cancelled) return;
        setData(json);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load funnel");
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
        <h2 className="text-sm font-semibold text-slate-700">Feedback Funnel</h2>
        <p className="mt-2 text-sm text-slate-400">Loading funnel…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Feedback Funnel</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (!data || data.stages.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Feedback Funnel</h2>
        <p className="mt-2 text-sm text-slate-400">No funnel data available.</p>
      </div>
    );
  }

  const topCount = data.stages[0].count;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Feedback Funnel</h2>
      <p className="mt-1 text-xs text-slate-400">
        Triage flow: NEW → ACKNOWLEDGED → ACTIONED (last 30 days)
      </p>

      <div className="mt-4 space-y-3">
        {data.stages.map((stage) => {
          // Width proportional to this stage's count relative to the
          // top-of-funnel (NEW) count. Falls back to a minimal sliver when
          // the top count is zero but this stage has data.
          const widthPct =
            topCount > 0
              ? Math.max((stage.count / topCount) * 100, stage.count > 0 ? 4 : 0)
              : stage.count > 0
              ? 100
              : 0;

          return (
            <div key={stage.name} className="w-full">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{stage.name}</span>
                <span className="text-slate-500">
                  {stage.count}{" "}
                  <span className="text-slate-400">
                    ({stage.percentage.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="h-8 w-full overflow-hidden rounded-md bg-slate-100">
                <div
                  className={`flex h-full items-center justify-end rounded-md px-2 text-xs font-medium text-white transition-all ${STAGE_COLORS[stage.name]}`}
                  style={{ width: `${widthPct}%` }}
                  role="progressbar"
                  aria-valuenow={stage.count}
                  aria-valuemin={0}
                  aria-valuemax={topCount || stage.count || 1}
                  aria-label={`${stage.name} stage`}
                >
                  {stage.count > 0 && stage.percentage.toFixed(0)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Conversion Rates
        </h3>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-400">New → Acknowledged</dt>
            <dd className="font-semibold text-indigo-600">
              {data.conversionRates.newToAcknowledged.toFixed(0)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Acknowledged → Actioned</dt>
            <dd className="font-semibold text-blue-600">
              {data.conversionRates.acknowledgedToActioned.toFixed(0)}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Overall</dt>
            <dd className="font-semibold text-green-600">
              {data.conversionRates.overall.toFixed(0)}%
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

export default FunnelChart;
