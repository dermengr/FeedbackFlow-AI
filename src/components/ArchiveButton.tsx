"use client";

import { useState } from "react";

type Props = {
  feedbackItemId: string;
  isArchived: boolean;
};

// Archive / Unarchive toggle for a feedback item.
//
// When archiving, the user is asked to confirm and may optionally provide a
// reason (e.g. "resolved", "irrelevant"). Unarchiving is a single click.
export function ArchiveButton({ feedbackItemId, isArchived }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [reason, setReason] = useState("");

  async function archive() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/feedback/${feedbackItemId}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Archive failed" }));
      setError(data.error ?? "Archive failed");
      return;
    }
    setShowConfirm(false);
    setReason("");
    window.location.reload();
  }

  async function unarchive() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/feedback/${feedbackItemId}/archive`, {
      method: "DELETE",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res
        .json()
        .catch(() => ({ error: "Unarchive failed" }));
      setError(data.error ?? "Unarchive failed");
      return;
    }
    window.location.reload();
  }

  if (isArchived) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700">
            Archived
          </span>
          <button
            disabled={busy}
            onClick={unarchive}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            Unarchive
          </button>
          {busy && <span className="text-xs text-slate-500">Working…</span>}
        </div>
        {error && <p className="text-xs text-rose-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          disabled={busy}
          onClick={() => setShowConfirm((v) => !v)}
          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
        >
          Archive
        </button>
        {busy && <span className="text-xs text-slate-500">Working…</span>}
      </div>

      {showConfirm && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-700">
            Archive this feedback item? It will be hidden from the active
            inbox but kept for history.
          </p>
          <input
            type="text"
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional), e.g. resolved, irrelevant"
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-60"
          />
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              onClick={archive}
              className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Confirm Archive
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setShowConfirm(false);
                setReason("");
                setError(null);
              }}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
