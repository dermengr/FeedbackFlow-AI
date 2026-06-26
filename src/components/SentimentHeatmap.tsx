"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeatmapCell } from "@/lib/heatmap";

type Status = "loading" | "error" | "ready";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// JS Date#getDay: 0=Sun..6=Sat. Reorder so Monday is the first row.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Map a negative-sentiment ratio (0..1) to an indigo background color with
// intensity proportional to the ratio. Cells with no data render as a faint
// slate fill so the grid structure stays visible.
function cellStyle(cell: HeatmapCell): string {
  if (cell.total === 0) {
    return "bg-slate-100";
  }
  const ratio = cell.negative / cell.total; // 0..1
  // 5 intensity steps from light to dark indigo.
  if (ratio >= 0.8) return "bg-indigo-900";
  if (ratio >= 0.6) return "bg-indigo-700";
  if (ratio >= 0.4) return "bg-indigo-500";
  if (ratio >= 0.2) return "bg-indigo-300";
  return "bg-indigo-100";
}

export function SentimentHeatmap() {
  const [grid, setGrid] = useState<HeatmapCell[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch("/api/heatmap?days=30");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setGrid(data.grid ?? []);
        setDays(data.days ?? 30);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load heatmap");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Index cells by (day*24 + hour) for O(1) lookup.
  const byIndex = useMemo(() => {
    const map = new Map<number, HeatmapCell>();
    for (const c of grid) map.set(c.day * 24 + c.hour, c);
    return map;
  }, [grid]);

  const maxTotal = useMemo(() => {
    let max = 0;
    for (const c of grid) if (c.total > max) max = c.total;
    return max;
  }, [grid]);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Sentiment Heatmap</h2>
        <p className="mt-2 text-sm text-slate-400">Loading heatmap…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Sentiment Heatmap</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Sentiment Heatmap</h2>
        <span className="text-xs text-slate-400">Last {days} days</span>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Negative sentiment intensity by day-of-week and hour-of-day.
      </p>

      <div className="mt-4 overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Hour labels across the top */}
          <div className="flex">
            <div className="w-10 shrink-0" />
            {HOURS.map((h) => (
              <div
                key={h}
                className="flex-1 text-center text-[10px] leading-4 text-slate-400"
              >
                {h % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Rows: one per day (Mon..Sun) */}
          {DAY_ORDER.map((day) => (
            <div key={day} className="mt-px flex items-center">
              <div className="w-10 shrink-0 text-right pr-1 text-[10px] font-medium text-slate-600">
                {DAY_LABELS[DAY_ORDER.indexOf(day)]}
              </div>
              {HOURS.map((hour) => {
                const c =
                  byIndex.get(day * 24 + hour) ??
                  ({ day, hour, positive: 0, neutral: 0, negative: 0, total: 0 } as HeatmapCell);
                const tooltip =
                  `${DAY_LABELS[DAY_ORDER.indexOf(day)]} ${hour}:00\n` +
                  `Total: ${c.total}\n` +
                  `Positive: ${c.positive}\n` +
                  `Neutral: ${c.neutral}\n` +
                  `Negative: ${c.negative}` +
                  (c.total > 0
                    ? `\nNegative ratio: ${((c.negative / c.total) * 100).toFixed(0)}%`
                    : "");
                return (
                  <div
                    key={hour}
                    role="gridcell"
                    aria-label={tooltip.replace(/\n/g, "; ")}
                    title={tooltip}
                    className={`h-5 flex-1 rounded-sm ${cellStyle(c)} ${
                      c.total > 0 ? "cursor-pointer" : ""
                    } transition-colors hover:ring-1 hover:ring-indigo-400`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500">
        <span>Less negative</span>
        <div className="flex items-center gap-px">
          <div className="h-3 w-3 rounded-sm bg-slate-100" />
          <div className="h-3 w-3 rounded-sm bg-indigo-100" />
          <div className="h-3 w-3 rounded-sm bg-indigo-300" />
          <div className="h-3 w-3 rounded-sm bg-indigo-500" />
          <div className="h-3 w-3 rounded-sm bg-indigo-700" />
          <div className="h-3 w-3 rounded-sm bg-indigo-900" />
        </div>
        <span>More negative</span>
        {maxTotal > 0 && (
          <span className="ml-auto text-slate-400">Max cell volume: {maxTotal}</span>
        )}
      </div>
    </div>
  );
}
