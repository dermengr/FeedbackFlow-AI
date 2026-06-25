"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FEEDBACK_STATUSES, FeedbackStatus } from "@/lib/types";
import { StatusBadge } from "@/components/Badges";

export function StatusSelect({
  itemId,
  status,
}: {
  itemId: string;
  status: FeedbackStatus;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<FeedbackStatus>(status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: FeedbackStatus) {
    if (next === current) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/feedback/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Update failed" }));
      setError(data.error ?? "Update failed");
      return;
    }
    setCurrent(next);
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-700">Triage status:</span>
        <StatusBadge status={current} />
      </div>
      <div className="flex flex-wrap gap-2">
        {FEEDBACK_STATUSES.map((s) => (
          <button
            key={s}
            disabled={saving || s === current}
            onClick={() => handleChange(s)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
              s === current
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            } disabled:opacity-60`}
          >
            {s.toLowerCase()}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
