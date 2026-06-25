"use client";

import { useEffect, useState } from "react";
import type { TopicTrend } from "@/lib/trends";

type Status = "loading" | "error" | "ready";

export function RisingTopics() {
  const [trends, setTrends] = useState<TopicTrend[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/trends");
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

  // Show top 5 rising topics first; fall back to top 5 by sort order.
  const rising = trends.filter((t) => t.direction === "rising").slice(0, 5);
  const visible = rising.length > 0 ? rising : trends.slice(0, 5);

  if (status === "loading") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Rising Topics</h2>
        <p className="mt-2 text-sm text-slate-400">Loading trends…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Rising Topics</h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (visible.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Rising Topics</h2>
        <p className="mt-2 text-sm text-slate-400">No topic data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Rising Topics</h2>
      <ul className="mt-3 space-y-2">
        {visible.map((t) => {
          const color =
            t.direction === "rising"
              ? "text-red-600"
              : t.direction === "falling"
              ? "text-green-600"
              : "text-slate-500";
          const pctLabel = Number.isFinite(t.changePct)
            ? `${t.changePct > 0 ? "+" : ""}${t.changePct.toFixed(0)}%`
            : "New";
          return (
            <li
              key={t.topic}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-slate-700">
                {t.direction === "rising" && (
                  <span aria-label="rising" title="rising">
                    🔥
                  </span>
                )}
                {t.topic}
              </span>
              <span className={`font-medium ${color}`}>{pctLabel}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
