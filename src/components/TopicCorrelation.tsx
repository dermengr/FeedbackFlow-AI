"use client";

import { useEffect, useState } from "react";
import type {
  TopicCorrelation,
  CorrelationStrength,
} from "@/lib/correlations";

type Status = "loading" | "error" | "ready";

const STRENGTH_BADGE: Record<
  CorrelationStrength,
  { label: string; classes: string }
> = {
  strong: {
    label: "strong",
    classes: "bg-red-100 text-red-700 border-red-200",
  },
  moderate: {
    label: "moderate",
    classes: "bg-amber-100 text-amber-700 border-amber-200",
  },
  weak: {
    label: "weak",
    classes: "bg-slate-100 text-slate-600 border-slate-200",
  },
};

export function TopicCorrelation() {
  const [correlations, setCorrelations] = useState<TopicCorrelation[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/correlations");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        if (cancelled) return;
        setCorrelations(data.correlations ?? []);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(
          err instanceof Error ? err.message : "Failed to load correlations"
        );
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
        <h2 className="text-sm font-semibold text-slate-700">
          Topic Correlations
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Loading correlations…
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">
          Topic Correlations
        </h2>
        <p className="mt-2 text-sm text-red-600">{errorMsg}</p>
      </div>
    );
  }

  if (correlations.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">
          Topic Correlations
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          No co-occurring topics found.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">
        Topic Correlations
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        Topic pairs that most frequently appear together in feedback.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-4">Topic A</th>
              <th className="py-2 pr-4">Topic B</th>
              <th className="py-2 pr-4 text-right">Co-occurrences</th>
              <th className="py-2 pr-2">Strength</th>
            </tr>
          </thead>
          <tbody>
            {correlations.map((c) => {
              const badge = STRENGTH_BADGE[c.strength];
              return (
                <tr
                  key={`${c.topicA}|${c.topicB}`}
                  className="border-b border-slate-100 last:border-0"
                >
                  <td className="py-2 pr-4 font-medium text-slate-700">
                    {c.topicA}
                  </td>
                  <td className="py-2 pr-4 font-medium text-slate-700">
                    {c.topicB}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-600">
                    {c.count}
                  </td>
                  <td className="py-2 pr-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badge.classes}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
