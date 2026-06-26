"use client";

import { useEffect, useState, useCallback } from "react";
import type { RealtimeStats } from "@/lib/realtime-stats";
import { formatStatsForDisplay } from "@/lib/realtime-stats";

type Status = "loading" | "error" | "ready";

const REFRESH_INTERVAL_MS = 30_000;

interface StatCardProps {
  title: string;
  value: number;
  label: string;
  accent: string;
}

function StatCard({ title, value, label, accent }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function RealtimeStats() {
  const [stats, setStats] = useState<RealtimeStats | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/realtime", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = (await res.json()) as RealtimeStats;
      setStats(data);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load stats");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [load]);

  const display = stats ? formatStatsForDisplay(stats) : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Real-time Stats</h2>
        <span className="flex items-center gap-2 text-xs font-medium text-indigo-600">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
          </span>
          Live
        </span>
      </div>

      {status === "loading" && (
        <p className="mt-4 text-sm text-slate-400">Loading live stats…</p>
      )}

      {status === "error" && (
        <p className="mt-4 text-sm text-red-600">{errorMsg}</p>
      )}

      {status === "ready" && display && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Last Hour Items"
              value={display.lastHourItems.value}
              label={display.lastHourItems.label}
              accent="text-indigo-600"
            />
            <StatCard
              title="Pending Triage"
              value={display.pendingTriage.value}
              label={display.pendingTriage.label}
              accent="text-amber-600"
            />
            <StatCard
              title="Unassigned Critical"
              value={display.unassignedHighSeverity.value}
              label={display.unassignedHighSeverity.label}
              accent="text-red-600"
            />
            <StatCard
              title="Recent Comments"
              value={display.lastHourComments.value}
              label={display.lastHourComments.label}
              accent="text-slate-700"
            />
          </div>

          {display.recentIngestRuns.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Recent Ingest Runs
              </p>
              <ul className="mt-2 space-y-1">
                {display.recentIngestRuns.map((run) => {
                  const statusColor =
                    run.status === "SUCCESS"
                      ? "text-green-600"
                      : run.status === "PARTIAL"
                      ? "text-amber-600"
                      : "text-red-600";
                  return (
                    <li
                      key={run.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-700">
                        <span className={`font-medium ${statusColor}`}>
                          {run.status}
                        </span>{" "}
                        <span className="text-slate-600">{run.source}</span>
                        <span className="text-slate-400">
                          {" "}
                          · {run.itemsNew}/{run.itemsFetched} new
                        </span>
                      </span>
                      <span className="text-slate-400">
                        {run.relativeTime}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
