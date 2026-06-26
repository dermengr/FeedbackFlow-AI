"use client";

import { useState } from "react";
import type { RootCauseResult } from "@/lib/root-cause";

type Status = "idle" | "loading" | "error" | "ready";

interface RootCauseAnalysisProps {
  /** IDs of the related feedback items to analyze. */
  feedbackItemIds: string[];
}

interface ApiResponse {
  analysis: RootCauseResult;
}

export function RootCauseAnalysis({ feedbackItemIds }: RootCauseAnalysisProps) {
  const [result, setResult] = useState<RootCauseResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function analyze() {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackItemIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error ?? `Request failed with status ${res.status}`
        );
      }
      const data: ApiResponse = await res.json();
      setResult(data.analysis);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to analyze root causes"
      );
      setStatus("error");
    }
  }

  const confidencePct = result
    ? Math.round(result.confidence * 100)
    : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Root Cause Analysis
        </h2>
        <button
          onClick={analyze}
          disabled={status === "loading" || feedbackItemIds.length === 0}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? "Analyzing…" : "Analyze Root Causes"}
        </button>
      </div>

      {feedbackItemIds.length === 0 && (
        <p className="mt-3 text-sm text-slate-400">
          Select feedback items to analyze.
        </p>
      )}

      {/* Loading state */}
      {status === "loading" && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {/* Error state */}
      {status === "error" && (
        <div className="mt-4">
          <p className="text-sm text-red-600">{errorMsg}</p>
          <button
            onClick={analyze}
            className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Results */}
      {status === "ready" && result && (
        <div className="mt-5 space-y-5">
          {/* Confidence bar */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Confidence
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {confidencePct}%
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Root causes (red) */}
            <Section
              title="Root Causes"
              accent="red"
              items={result.rootCauses}
            />

            {/* Patterns (amber) */}
            <Section
              title="Patterns"
              accent="amber"
              items={result.patterns}
            />

            {/* Recommended actions (green) */}
            <Section
              title="Recommended Actions"
              accent="green"
              items={result.recommendedActions}
              numbered
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  title,
  accent,
  items,
  numbered = false,
}: {
  title: string;
  accent: "red" | "amber" | "green";
  items: string[];
  numbered?: boolean;
}) {
  const styles = {
    red: { border: "border-red-100", title: "text-red-700", dot: "bg-red-500" },
    amber: {
      border: "border-amber-100",
      title: "text-amber-700",
      dot: "bg-amber-500",
    },
    green: {
      border: "border-green-100",
      title: "text-green-700",
      dot: "bg-green-500",
    },
  }[accent];

  return (
    <div className={`rounded-lg border ${styles.border} bg-slate-50/50 p-4`}>
      <h3
        className={`text-xs font-semibold uppercase tracking-wide ${styles.title}`}
      >
        {title}
      </h3>
      <div className="mt-2">
        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-700">
                {numbered ? (
                  <span className="flex-shrink-0 font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                ) : (
                  <span
                    className={`mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.dot}`}
                  />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400">No data available.</p>
        )}
      </div>
    </div>
  );
}
