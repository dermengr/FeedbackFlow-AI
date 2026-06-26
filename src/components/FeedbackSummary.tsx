"use client";

import { useState } from "react";
import type { FeedbackSummaryResult } from "@/lib/summarization";

interface FeedbackSummaryProps {
  /** Optional explicit list of feedback item ids to summarize. */
  feedbackItemIds?: string[];
  /** Optional source filter; summarizes all items from this source. */
  source?: string;
  /**
   * Time window in days when using the `source` filter. Defaults to 7.
   * Ignored when `feedbackItemIds` is provided.
   */
  days?: number;
}

type Status = "idle" | "loading" | "error" | "ready";

/**
 * Feedback Summarization panel.
 *
 * A "Generate Summary" button that POSTs to /api/summarize and renders the
 * LLM-generated report: executive summary, key findings, sentiment breakdown,
 * top issues, and recommendations. Includes loading and error states.
 */
export function FeedbackSummary({
  feedbackItemIds,
  source,
  days = 7,
}: FeedbackSummaryProps) {
  const [summary, setSummary] = useState<FeedbackSummaryResult | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleGenerate() {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(feedbackItemIds ? { feedbackItemIds } : {}),
          ...(source ? { source } : {}),
          days,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed with status ${res.status}`);
      }
      const data = (await res.json()) as { summary: FeedbackSummaryResult };
      setSummary(data.summary);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to generate summary"
      );
      setStatus("error");
    }
  }

  const hasFilter = (feedbackItemIds?.length ?? 0) > 0 || Boolean(source);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-800">
          Feedback Summarization
        </h2>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === "loading" || !hasFilter}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "Generating…" : "Generate Summary"}
        </button>
      </div>

      {!hasFilter && (
        <p className="mt-3 text-sm text-slate-400">
          Provide feedback item ids or a source to generate a summary.
        </p>
      )}

      {status === "error" && (
        <div className="mt-3">
          <p className="text-sm text-red-600" role="alert">
            {errorMsg}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="mt-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Retry
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="mt-4 space-y-3" aria-live="polite">
          <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
        </div>
      )}

      {status === "ready" && summary && (
        <SummaryView summary={summary} onRegenerate={handleGenerate} />
      )}
    </section>
  );
}

function SummaryView({
  summary,
  onRegenerate,
}: {
  summary: FeedbackSummaryResult;
  onRegenerate: () => void;
}) {
  const { sentimentBreakdown: sb } = summary;
  const total = sb.positive + sb.neutral + sb.negative || 1;
  const pct = (n: number) => Math.round((n / total) * 100);

  const hasContent =
    summary.executiveSummary.length > 0 ||
    summary.keyFindings.length > 0 ||
    summary.topIssues.length > 0 ||
    summary.recommendations.length > 0;

  return (
    <div className="mt-4 space-y-5">
      {/* Executive summary */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-indigo-700">
          Executive Summary
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {summary.executiveSummary || "No executive summary available."}
        </p>
      </div>

      {/* Sentiment breakdown */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
          Sentiment Breakdown
        </h3>
        <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="bg-emerald-500"
            style={{ width: `${pct(sb.positive)}%` }}
            title={`Positive: ${sb.positive}`}
          />
          <div
            className="bg-slate-400"
            style={{ width: `${pct(sb.neutral)}%` }}
            title={`Neutral: ${sb.neutral}`}
          />
          <div
            className="bg-rose-500"
            style={{ width: `${pct(sb.negative)}%` }}
            title={`Negative: ${sb.negative}`}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Positive {sb.positive}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Neutral {sb.neutral}
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            Negative {sb.negative}
          </span>
        </div>
      </div>

      {!hasContent && (
        <p className="text-sm text-slate-400">
          Not enough feedback data to generate a detailed summary.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Key findings */}
        <Card title="Key Findings" accent="indigo">
          {summary.keyFindings.length > 0 ? (
            <ul className="space-y-2">
              {summary.keyFindings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint />
          )}
        </Card>

        {/* Top issues */}
        <Card title="Top Issues" accent="rose">
          {summary.topIssues.length > 0 ? (
            <ul className="space-y-2">
              {summary.topIssues.map((issue, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint />
          )}
        </Card>

        {/* Recommendations */}
        <Card title="Recommendations" accent="slate">
          {summary.recommendations.length > 0 ? (
            <ul className="space-y-2">
              {summary.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="flex-shrink-0 font-semibold text-slate-400">
                    {i + 1}.
                  </span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint />
          )}
        </Card>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onRegenerate}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Regenerate
        </button>
      </div>
    </div>
  );
}

function Card({
  title,
  accent,
  children,
}: {
  title: string;
  accent: "indigo" | "slate" | "rose";
  children: React.ReactNode;
}) {
  const border =
    accent === "indigo"
      ? "border-indigo-100"
      : accent === "rose"
        ? "border-rose-100"
        : "border-slate-100";
  const titleColor =
    accent === "indigo"
      ? "text-indigo-700"
      : accent === "rose"
        ? "text-rose-700"
        : "text-slate-700";
  return (
    <div className={`rounded-lg border ${border} bg-slate-50/50 p-4`}>
      <h3 className={`text-xs font-semibold uppercase tracking-wide ${titleColor}`}>
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function EmptyHint() {
  return <p className="text-sm text-slate-400">No data available.</p>;
}
