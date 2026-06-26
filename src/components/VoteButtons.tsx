"use client";

import { useState, useEffect, useCallback } from "react";

type VoteType = "up" | "down" | "heart";

type VoteSummary = {
  up: number;
  down: number;
  heart: number;
  total: number;
  userVotes: VoteType[];
};

type ButtonConfig = {
  type: VoteType;
  label: string;
  activeClass: string;
  idleClass: string;
};

const BUTTONS: ButtonConfig[] = [
  {
    type: "up",
    label: "👍",
    activeClass:
      "border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-500",
    idleClass: "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50",
  },
  {
    type: "down",
    label: "👎",
    activeClass:
      "border-rose-500 bg-rose-50 text-rose-700 ring-1 ring-rose-500",
    idleClass: "border-slate-200 bg-white text-slate-600 hover:border-rose-300 hover:bg-rose-50",
  },
  {
    type: "heart",
    label: "❤️",
    activeClass:
      "border-pink-500 bg-pink-50 text-pink-700 ring-1 ring-pink-500",
    idleClass: "border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:bg-pink-50",
  },
];

export function VoteButtons({ feedbackItemId }: { feedbackItemId: string }) {
  const [summary, setSummary] = useState<VoteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<VoteType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/vote`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to load votes" }));
        throw new Error(data.error ?? "Failed to load votes");
      }
      const data = (await res.json()) as VoteSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load votes");
    } finally {
      setLoading(false);
    }
  }, [feedbackItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(type: VoteType) {
    if (!summary || pending) return;
    const hasVoted = summary.userVotes.includes(type);
    setPending(type);
    setError(null);
    try {
      // DELETE reads the type from the query string; POST reads it from the body.
      const url = new URL(
        `/api/feedback/${feedbackItemId}/vote`,
        window.location.origin
      );
      const init: RequestInit = {
        method: hasVoted ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
      };
      if (hasVoted) {
        url.searchParams.set("type", type);
      } else {
        init.body = JSON.stringify({ type });
      }

      const res = await fetch(url.toString(), init);
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({
            error: hasVoted ? "Failed to remove vote" : "Failed to cast vote",
          }));
        throw new Error(
          data.error ?? (hasVoted ? "Failed to remove vote" : "Failed to cast vote")
        );
      }
      const data = (await res.json()) as VoteSummary;
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update vote");
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        {BUTTONS.map((b) => (
          <span
            key={b.type}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-400"
          >
            <span>{b.label}</span>
            <span>–</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {BUTTONS.map((b) => {
          const count = summary ? summary[b.type] : 0;
          const active = summary ? summary.userVotes.includes(b.type) : false;
          const isPending = pending === b.type;
          return (
            <button
              key={b.type}
              type="button"
              onClick={() => void toggle(b.type)}
              disabled={isPending}
              aria-pressed={active}
              aria-label={`${b.type} vote`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active ? b.activeClass : b.idleClass
              }`}
            >
              <span>{b.label}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
