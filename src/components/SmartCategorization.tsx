"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Smart Categorization.
 *
 * A "Suggest Categories" button that calls the local LLM (via
 * /api/feedback/:id/suggest-categories) to auto-suggest custom category labels
 * for a feedback item. Suggestions are rendered as clickable chips and the
 * model's reasoning is shown beneath them.
 *
 * Clicking a chip calls the optional `onSelectCategory` callback so parent
 * components can apply the label (e.g. create a Label and attach it).
 */
interface CategorySuggestions {
  feedbackItemId: string;
  categories: string[];
  reasoning: string;
}

interface SmartCategorizationProps {
  feedbackItemId: string;
  /** Called when the user clicks a suggested category chip. */
  onSelectCategory?: (category: string) => void;
}

export function SmartCategorization({
  feedbackItemId,
  onSelectCategory,
}: SmartCategorizationProps) {
  const [suggestions, setSuggestions] = useState<CategorySuggestions | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());

  async function handleSuggest() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuggestions(null);
    setApplied(new Set());
    try {
      const res = await fetch(
        `/api/feedback/${feedbackItemId}/suggest-categories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to suggest categories" }));
        throw new Error(data.error ?? "Failed to suggest categories");
      }
      const data = (await res.json()) as CategorySuggestions;
      setSuggestions(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to suggest categories"
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChipClick(category: string) {
    if (applied.has(category)) return;
    setApplied((prev) => new Set(prev).add(category));
    onSelectCategory?.(category);
  }

  const hasSuggestions =
    suggestions !== null && suggestions.categories.length > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Smart Categorization
        </h2>
        <button
          type="button"
          onClick={handleSuggest}
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Suggesting…" : "Suggest Categories"}
        </button>
      </div>

      <p className="mt-1 text-sm text-slate-500">
        Use the local LLM to auto-suggest custom category labels for this
        feedback item.
      </p>

      {error && (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {loading && !hasSuggestions && (
        <p className="mt-3 text-sm text-slate-400">Generating suggestions…</p>
      )}

      {hasSuggestions && (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {suggestions!.categories.map((category, idx) => {
              const isApplied = applied.has(category);
              return (
                <button
                  key={`${category}-${idx}`}
                  type="button"
                  onClick={() => handleChipClick(category)}
                  disabled={isApplied}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    isApplied
                      ? "border-indigo-200 bg-indigo-100 text-indigo-700 cursor-default"
                      : "border-slate-200 bg-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                  )}
                >
                  {category}
                  {isApplied && (
                    <span className="ml-1 text-indigo-500" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {suggestions!.reasoning && (
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reasoning
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {suggestions!.reasoning}
              </p>
            </div>
          )}
        </div>
      )}

      {!loading && suggestions !== null && !hasSuggestions && (
        <p className="mt-3 text-sm text-slate-400">
          No categories were suggested for this item.
        </p>
      )}
    </section>
  );
}
