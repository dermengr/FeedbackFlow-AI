"use client";

import { useState } from "react";
import { FEEDBACK_STATUSES, FeedbackStatus } from "@/lib/types";

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void; // called after action completes (e.g. to refetch)
}

export function BulkActionBar({
  selectedIds,
  onClear,
  onDone,
}: BulkActionBarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignValue, setAssignValue] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (selectedIds.length === 0) return null;

  async function runAction(action: "status" | "assign" | "label" | "delete", value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Bulk action failed" }));
        setError(data.error ?? "Bulk action failed");
        return;
      }
      onDone();
    } catch {
      setError("Bulk action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-3 shadow-lg">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">
          {selectedIds.length} {selectedIds.length === 1 ? "item" : "items"} selected
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Set Status:</span>
          <div className="flex gap-1">
            {FEEDBACK_STATUSES.map((s) => (
              <button
                key={s}
                disabled={busy}
                onClick={() => runAction("status", s)}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                {s.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="text"
            value={assignValue}
            onChange={(e) => setAssignValue(e.target.value)}
            placeholder="User ID"
            disabled={busy}
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            disabled={busy}
            onClick={() => runAction("assign", assignValue)}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Assign
          </button>
        </div>

        <div className="flex items-center gap-1">
          <input
            type="text"
            value={labelValue}
            onChange={(e) => setLabelValue(e.target.value)}
            placeholder="Label ID"
            disabled={busy}
            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <button
            disabled={busy}
            onClick={() => runAction("label", labelValue)}
            className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
          >
            Add Label
          </button>
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <span className="text-xs text-rose-600">Confirm?</span>
            <button
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false);
                runAction("delete", "");
              }}
              className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Yes
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              No
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="rounded-md bg-rose-600 px-2 py-1 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Delete
          </button>
        )}

        <button
          disabled={busy}
          onClick={onClear}
          className="ml-auto rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60"
        >
          Clear selection
        </button>
      </div>

      {error && (
        <p className="mx-auto mt-2 max-w-5xl text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
