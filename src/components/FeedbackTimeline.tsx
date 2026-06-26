"use client";

import { useEffect, useState } from "react";
import type { TimelineData, TimelineDay } from "@/lib/timeline";

type Status = "loading" | "error" | "ready";

// Tailwind classes for each sentiment segment of the stacked bar.
const POSITIVE_CLASS = "bg-green-500";
const NEUTRAL_CLASS = "bg-slate-400";
const NEGATIVE_CLASS = "bg-red-500";

// Render a YYYY-MM-DD key as a human-friendly "Mon DD, YYYY" label.
function formatDate(iso: string): string {
  // Parse as a local calendar day to avoid off-by-one UTC shifts.
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function FeedbackTimeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [days, setDays] = useState<number>(30);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const res = await fetch("/api/timeline?days=30");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const json = (await res.json()) as TimelineData & { windowDays?: number };
        if (cancelled) return;
        setData({ days: json.days ?? [], summary: json.summary });
        setDays(json.windowDays ?? 30);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : "Failed to load timeline");
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
        <h2 className="text-sm font-semibold text-slate-700">Feedback Timeline</h2>
        <p className="mt-2 text-sm text-slate-400">Loading timeline…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Feedback Timeline</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Feedback Timeline</h2>
        <p className="mt-2 text-sm text-slate-400">No feedback activity in the last {days} days.</p>
      </div>
    );
  }

  // Max total across all days, used to scale each day's stacked bar width.
  const maxTotal = data.days.reduce((max, d) => (d.total > max ? d.total : max), 0);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Feedback Timeline</h2>
        <span className="text-xs text-slate-400">Last {days} days</span>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Daily feedback volume with sentiment breakdown.
      </p>

      {/* Summary stats */}
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Total Items
          </dt>
          <dd className="text-lg font-semibold text-slate-800">
            {data.summary.totalItems}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Avg / Day
          </dt>
          <dd className="text-lg font-semibold text-indigo-600">
            {data.summary.avgPerDay.toFixed(1)}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Peak Day
          </dt>
          <dd className="text-sm font-semibold text-slate-800">
            {data.summary.peakDay ? formatDate(data.summary.peakDay) : "—"}
          </dd>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            Peak Count
          </dt>
          <dd className="text-lg font-semibold text-slate-800">
            {data.summary.peakCount}
          </dd>
        </div>
      </dl>

      {/* Vertical timeline */}
      <ol className="mt-5 space-y-3">
        {data.days.map((day) => (
          <TimelineRow key={day.date} day={day} maxTotal={maxTotal} />
        ))}
      </ol>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-sm ${POSITIVE_CLASS}`} /> Positive
        </span>
        <span className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-sm ${NEUTRAL_CLASS}`} /> Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className={`h-3 w-3 rounded-sm ${NEGATIVE_CLASS}`} /> Negative
        </span>
      </div>
    </div>
  );
}

// A single day entry in the vertical timeline: a date label, total count, and a
// horizontally stacked sentiment bar scaled relative to the busiest day.
function TimelineRow({ day, maxTotal }: { day: TimelineDay; maxTotal: number }) {
  const widthPct =
    maxTotal > 0 ? Math.max((day.total / maxTotal) * 100, day.total > 0 ? 2 : 0) : 0;

  const posPct = day.total > 0 ? (day.positive / day.total) * 100 : 0;
  const neuPct = day.total > 0 ? (day.neutral / day.total) * 100 : 0;
  const negPct = day.total > 0 ? (day.negative / day.total) * 100 : 0;

  const tooltip =
    `${formatDate(day.date)}\n` +
    `Total: ${day.total}\n` +
    `Positive: ${day.positive}\n` +
    `Neutral: ${day.neutral}\n` +
    `Negative: ${day.negative}`;

  return (
    <li className="relative flex items-center gap-3">
      {/* Timeline node + connector rail */}
      <div className="flex shrink-0 flex-col items-center">
        <span className="h-2.5 w-2.5 rounded-full bg-indigo-500 ring-2 ring-indigo-100" />
      </div>

      {/* Date + count */}
      <div className="w-28 shrink-0">
        <p className="text-xs font-medium text-slate-700">{formatDate(day.date)}</p>
        <p className="text-[10px] text-slate-400">{day.total} item{day.total === 1 ? "" : "s"}</p>
      </div>

      {/* Stacked sentiment bar */}
      <div className="flex-1">
        <div
          className="h-5 w-full overflow-hidden rounded-md bg-slate-100"
          title={tooltip}
          aria-label={tooltip.replace(/\n/g, "; ")}
        >
          <div
            className="flex h-full"
            style={{ width: `${widthPct}%` }}
            role="img"
            aria-label={`Sentiment breakdown for ${day.date}`}
          >
            {day.positive > 0 && (
              <div className={`${POSITIVE_CLASS} h-full`} style={{ width: `${posPct}%` }} />
            )}
            {day.neutral > 0 && (
              <div className={`${NEUTRAL_CLASS} h-full`} style={{ width: `${neuPct}%` }} />
            )}
            {day.negative > 0 && (
              <div className={`${NEGATIVE_CLASS} h-full`} style={{ width: `${negPct}%` }} />
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export default FeedbackTimeline;
