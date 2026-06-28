"use client";

import { useState } from "react";
import { formatDate } from "@/lib/utils";
import { showToast } from "@/lib/toast";

export function SnoozeButton({
  feedbackItemId,
  snoozedUntil,
}: {
  feedbackItemId: string;
  snoozedUntil: string | null;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function snooze(until: Date) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/feedback/${feedbackItemId}/snooze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ until: until.toISOString() }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Snooze failed" }));
      const message = data.error ?? "Failed to snooze";
      setError(message);
      showToast(message, "error");
      return;
    }
    showToast("Snoozed", "success");
    window.location.reload();
  }

  async function unsnooze() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/feedback/${feedbackItemId}/snooze`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: "Unsnooze failed" }));
      const message = data.error ?? "Failed to unsnooze";
      setError(message);
      showToast(message, "error");
      return;
    }
    showToast("Unsnoozed", "success");
    window.location.reload();
  }

  if (snoozedUntil) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Snoozed until {formatDate(snoozedUntil)}
          </span>
          <button
            disabled={busy}
            onClick={unsnooze}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-60"
          >
            Unsnooze
          </button>
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  const presets: { label: string; days: number }[] = [
    { label: "1 day", days: 1 },
    { label: "3 days", days: 3 },
    { label: "1 week", days: 7 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          disabled={busy}
          onClick={() => setShowPicker((v) => !v)}
          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          Snooze
        </button>
        {busy && <span className="text-xs text-slate-500">Working…</span>}
      </div>

      {showPicker && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                disabled={busy}
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + p.days);
                  snooze(d);
                }}
                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              disabled={busy}
              onChange={(e) => {
                const value = e.target.value;
                if (!value) return;
                // Use end-of-day for the chosen date.
                const d = new Date(`${value}T23:59:59`);
                snooze(d);
              }}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-500">custom date</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
