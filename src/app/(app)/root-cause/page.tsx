"use client";

import { useEffect, useState } from "react";
import { PageShell, PageHeader, PageSection, AnimatedCard, AnimatedButton } from "@/components/PageShell";
import { showToast } from "@/lib/toast";

interface FeedbackItem {
  id: string;
  title: string | null;
  source: string;
  originalTimestamp: string;
  analysis?: {
    sentiment: string;
    summary: string | null;
    severityScore: number;
  } | null;
}

interface RootCauseAnalysis {
  rootCauses: string[];
  patterns: string[];
  recommendedActions: string[];
  confidence: number;
}

export const dynamic = "force-dynamic";

export default function RootCausePage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RootCauseAnalysis | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const MAX_ITEMS = 20;

  async function loadItems(q?: string) {
    setLoading(true);
    try {
      const url = q?.trim()
        ? `/api/search?q=${encodeURIComponent(q.trim())}&pageSize=50`
        : "/api/feedback?pageSize=50";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Failed to load feedback: ${res.status}`);
      }
      const json = (await res.json()) as
        | { items: FeedbackItem[]; total: number }
        | { results: FeedbackItem[]; total: number };
      const list = "items" in json ? json.items : json.results;
      setItems(list);
    } catch (err) {
      showToast(
        "Failed to load feedback items",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_ITEMS) {
          showToast(`You can select up to ${MAX_ITEMS} items`, "warning");
          return prev;
        }
        next.add(id);
      }
      setAnalysis(null);
      return next;
    });
  }

  async function handleAnalyze() {
    if (selectedIds.size === 0) {
      showToast("Select at least one feedback item", "warning");
      return;
    }
    if (selectedIds.size > MAX_ITEMS) {
      showToast(`You can select up to ${MAX_ITEMS} items`, "warning");
      return;
    }
    setAnalyzing(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/root-cause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackItemIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Analysis failed: ${res.status}`);
      }
      const json = (await res.json()) as { analysis: RootCauseAnalysis };
      setAnalysis(json.analysis);
    } catch (err) {
      showToast(
        "Root cause analysis failed",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Root Cause Analysis"
        description="Select up to 20 related feedback items to identify underlying root causes, patterns, and recommended actions."
      />

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label htmlFor="rc-search" className="sr-only">
                Search feedback
              </label>
              <input
                id="rc-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    loadItems(searchQuery);
                  }
                }}
                placeholder="Search feedback and press Enter"
                className="input-modern"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {selectedIds.size} / {MAX_ITEMS} selected
              </span>
              <AnimatedButton
                onClick={() => {
                  setSelectedIds(new Set());
                  setAnalysis(null);
                }}
                className="btn-secondary"
                disabled={selectedIds.size === 0}
              >
                Clear
              </AnimatedButton>
              <AnimatedButton
                onClick={handleAnalyze}
                className="btn-primary"
                disabled={selectedIds.size === 0 || analyzing}
              >
                {analyzing ? "Analyzing…" : "Analyze root causes"}
              </AnimatedButton>
            </div>
          </div>
        </AnimatedCard>
      </PageSection>

      <PageSection>
        <AnimatedCard className="p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent feedback items
          </h2>
          {loading ? (
            <p className="mt-3 text-sm text-slate-400">Loading…</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No feedback items found.</p>
          ) : (
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:bg-slate-100 dark:border-slate-700/50 dark:bg-slate-800/50 dark:hover:bg-slate-700/50"
                >
                  <input
                    id={`rc-${item.id}`}
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                  />
                  <label htmlFor={`rc-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <span className="truncate">
                        {item.title ?? "Untitled feedback"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="badge-soft">{item.source}</span>
                      {item.analysis?.sentiment && (
                        <span className="badge-soft capitalize">{item.analysis.sentiment}</span>
                      )}
                      {item.analysis?.severityScore !== undefined && (
                        <span className="badge-soft">S{item.analysis.severityScore}</span>
                      )}
                      <span className="truncate">
                        {item.analysis?.summary ?? "No summary"}
                      </span>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </AnimatedCard>
      </PageSection>

      {analysis && (
        <PageSection>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <AnimatedCard className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Root Causes
              </h3>
              {analysis.rootCauses.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No root causes identified.</p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.rootCauses.map((cause, i) => (
                    <li key={i}>{cause}</li>
                  ))}
                </ul>
              )}
            </AnimatedCard>

            <AnimatedCard className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Patterns
              </h3>
              {analysis.patterns.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No patterns detected.</p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.patterns.map((pattern, i) => (
                    <li key={i}>{pattern}</li>
                  ))}
                </ul>
              )}
            </AnimatedCard>

            <AnimatedCard className="p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recommended Actions
              </h3>
              {analysis.recommendedActions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">No recommendations.</p>
              ) : (
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {analysis.recommendedActions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ul>
              )}
            </AnimatedCard>
          </div>

          <AnimatedCard className="mt-4 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Confidence
              </span>
              <span className="text-sm font-bold text-brand-600">
                {Math.round(analysis.confidence * 100)}%
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(0, Math.min(100, analysis.confidence * 100))}%` }}
                role="progressbar"
                aria-valuenow={Math.round(analysis.confidence * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </AnimatedCard>
        </PageSection>
      )}
    </PageShell>
  );
}
