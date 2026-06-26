"use client";

import { useState } from "react";

/**
 * Predictive Severity Predictor.
 *
 * Lets a user paste raw feedback text and get an instant severity prediction
 * from the local LLM (via POST /api/predict-severity) *before* a full analysis
 * is run. Useful for triage / prioritisation.
 */

interface SeverityPrediction {
  severity: number;
  confidence: number;
  reasoning: string;
  suggestedPriority: string;
}

// Map a 1-5 severity to a tailwind colour bucket.
const severityStyles: Record<
  number,
  { label: string; text: string; bg: string; bar: string }
> = {
  1: {
    label: "1 — Trivial",
    text: "text-emerald-700",
    bg: "bg-emerald-100",
    bar: "bg-emerald-500",
  },
  2: {
    label: "2 — Low",
    text: "text-teal-700",
    bg: "bg-teal-100",
    bar: "bg-teal-500",
  },
  3: {
    label: "3 — Medium",
    text: "text-amber-700",
    bg: "bg-amber-100",
    bar: "bg-amber-500",
  },
  4: {
    label: "4 — High",
    text: "text-orange-700",
    bg: "bg-orange-100",
    bar: "bg-orange-500",
  },
  5: {
    label: "5 — Critical",
    text: "text-rose-700",
    bg: "bg-rose-100",
    bar: "bg-rose-500",
  },
};

const priorityStyles: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-teal-100 text-teal-700 border-teal-200",
};

function priorityClass(priority: string): string {
  const key = priority.trim().toLowerCase();
  return (
    priorityStyles[key] ??
    "bg-slate-100 text-slate-700 border-slate-200"
  );
}

export function SeverityPredictor() {
  const [text, setText] = useState("");
  const [prediction, setPrediction] = useState<SeverityPrediction | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePredict() {
    if (loading || !text.trim()) return;
    setLoading(true);
    setError(null);
    setPrediction(null);
    try {
      const res = await fetch("/api/predict-severity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to predict severity");
      }
      setPrediction(data.prediction as SeverityPrediction);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to predict severity"
      );
    } finally {
      setLoading(false);
    }
  }

  const style = prediction ? severityStyles[prediction.severity] : null;
  const confidencePct = prediction
    ? Math.round(Math.max(0, Math.min(1, prediction.confidence)) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Predictive Severity
        </h2>
        <button
          type="button"
          onClick={handlePredict}
          disabled={loading || !text.trim()}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Predicting…" : "Predict Severity"}
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Paste raw feedback to get an instant severity prediction before full
        analysis.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder="Paste customer feedback here…"
        className="mt-3 w-full resize-y rounded-md border border-slate-300 p-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />

      {error && (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <div className="mt-3 animate-pulse text-sm text-slate-400">
          Asking the local LLM to predict severity…
        </div>
      )}

      {prediction && style && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-semibold ${style.bg} ${style.text}`}
            >
              Severity {style.label}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${priorityClass(
                prediction.suggestedPriority
              )}`}
            >
              Priority: {prediction.suggestedPriority}
            </span>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Confidence</span>
              <span>{confidencePct}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full ${style.bar} transition-all`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Reasoning
            </h3>
            <p className="mt-1 text-sm text-slate-700">{prediction.reasoning}</p>
          </div>
        </div>
      )}
    </section>
  );
}
