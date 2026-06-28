"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/lib/toast";
import { SeverityBadge } from "@/components/Badges";
import { Sparkles } from "lucide-react";

interface SeverityPrediction {
  severity: number;
  confidence: number;
  reasoning: string;
  suggestedPriority: string;
}

interface SeverityPredictorProps {
  text: string;
}

export function SeverityPredictor({ text }: SeverityPredictorProps) {
  const [prediction, setPrediction] = useState<SeverityPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Predict only when the text is meaningfully long.
    if (!text || text.trim().length < 10) {
      setPrediction(null);
      setError(null);
      return;
    }

    let active = true;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/predict-severity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.slice(0, 8000) }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Prediction failed" }));
          const message = data.error ?? "Failed to predict severity";
          setError(message);
          if (active) showToast(message, "error");
          return;
        }
        const data = (await res.json()) as { prediction: SeverityPrediction };
        if (active) setPrediction(data.prediction);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to predict severity";
        setError(message);
        if (active) showToast(message, "error");
      } finally {
        if (active) setLoading(false);
      }
    }

    // Debounce slightly so we don't fire on every keystroke if this component is
    // ever used with live text. For a static detail page it still runs once.
    const timer = setTimeout(run, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [text]);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
        Predicting severity…
      </div>
    );
  }

  if (error) {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-300">
        <Sparkles className="h-3.5 w-3.5" />
        Prediction failed: {error}
      </div>
    );
  }

  if (!prediction) return null;

  return (
    <div className="inline-flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800/50">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" />
        <span className="font-medium text-slate-700 dark:text-slate-300">
          Predicted severity
        </span>
        <SeverityBadge score={prediction.severity} />
        <span className="text-slate-500 dark:text-slate-400">
          {Math.round(prediction.confidence * 100)}% confidence
        </span>
      </div>
      <div className="text-slate-600 dark:text-slate-400">
        <span className="font-medium">Priority suggestion:</span>{" "}
        {prediction.suggestedPriority}
      </div>
      <p className="max-w-prose text-slate-500 dark:text-slate-400">
        {prediction.reasoning}
      </p>
    </div>
  );
}
