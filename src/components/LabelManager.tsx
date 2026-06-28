"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LabelChips } from "@/components/LabelChips";
import { showToast } from "@/lib/toast";

interface Label {
  id: string;
  name: string;
  color: string;
}

const colorStyles: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  green: "bg-green-100 text-green-700 border-green-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
};

export function LabelManager({ feedbackItemId }: { feedbackItemId: string }) {
  const [currentLabels, setCurrentLabels] = useState<Label[]>([]);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchCurrent = useCallback(async () => {
    const res = await fetch(`/api/feedback/${feedbackItemId}/labels`);
    if (!res.ok) {
      throw new Error("Failed to load labels");
    }
    const data = await res.json();
    return (data.labels ?? []) as Label[];
  }, [feedbackItemId]);

  const fetchAvailable = useCallback(async () => {
    const res = await fetch(`/api/labels`);
    if (!res.ok) {
      throw new Error("Failed to load available labels");
    }
    const data = await res.json();
    // Accept either { labels: [...] } or a bare array.
    return (Array.isArray(data) ? data : data.labels ?? []) as Label[];
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [current, available] = await Promise.all([
          fetchCurrent(),
          fetchAvailable(),
        ]);
        if (!active) return;
        setCurrentLabels(current);
        setAvailableLabels(available);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchCurrent, fetchAvailable]);

  const assignedIds = new Set(currentLabels.map((l) => l.id));
  const unassigned = availableLabels.filter((l) => !assignedIds.has(l.id));

  const addLabel = async (labelId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labelId }),
      });
      if (res.status === 409) {
        // Already assigned — just refetch to stay in sync.
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to add label");
      }
      setCurrentLabels(await fetchCurrent());
      setMenuOpen(false);
      showToast("Label added", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add label";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  const removeLabel = async (labelId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/feedback/${feedbackItemId}/labels?labelId=${encodeURIComponent(labelId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to remove label");
      }
      setCurrentLabels(await fetchCurrent());
      showToast("Label removed", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove label";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Labels</h3>
        <div className="relative">
          <button
            type="button"
            disabled={loading || busy}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            + Add label
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-10 mt-1 max-h-56 w-48 overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {unassigned.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-400">
                  No labels available
                </div>
              ) : (
                unassigned.map((label) => {
                  const cls = colorStyles[label.color] ?? colorStyles.slate;
                  return (
                    <button
                      key={label.id}
                      type="button"
                      disabled={busy}
                      onClick={() => addLabel(label.id)}
                      className="flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      <span
                        className={cn(
                          "mr-2 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          cls
                        )}
                      >
                        {label.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-2 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading labels…</p>
      ) : currentLabels.length === 0 ? (
        <p className="text-xs text-slate-400">No labels assigned.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {currentLabels.map((label) => {
            const cls = colorStyles[label.color] ?? colorStyles.slate;
            return (
              <span
                key={label.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
                  cls
                )}
              >
                {label.name}
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`Remove ${label.name}`}
                  onClick={() => removeLabel(label.id)}
                  className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-current hover:bg-black/10 disabled:opacity-50"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Presentational-only rendering of the same set (kept for parity). */}
      <div className="sr-only">
        <LabelChips labels={currentLabels} />
      </div>
    </section>
  );
}
