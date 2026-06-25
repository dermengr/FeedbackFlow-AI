"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SentimentBadge } from "@/components/Badges";
import { truncate } from "@/lib/utils";

interface SimilarResult {
  id: string;
  title: string | null;
  externalId: string;
  sentiment: string | null;
  summary: string | null;
  similarity: number;
  url: string | null;
}

export function SimilarItems({ feedbackItemId }: { feedbackItemId: string }) {
  const [results, setResults] = useState<SimilarResult[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/feedback/${feedbackItemId}/similar`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setResults(data.results ?? []);
        setEnabled(data.enabled !== false);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [feedbackItemId]);

  if (loading) {
    return <p className="text-sm text-slate-400">Loading similar items…</p>;
  }
  if (!enabled) {
    return (
      <p className="text-sm text-slate-400">
 Semantic similarity disabled (set OPENAI_API_KEY).
      </p>
    );
  }
  if (results.length === 0) {
    return <p className="text-sm text-slate-400">No similar items found.</p>;
  }

  return (
    <ul className="space-y-2">
      {results.map((r) => (
        <li key={r.id}>
          <Link
            href={`/inbox/${r.id}`}
            className="block rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">
                {r.title ?? r.externalId}
              </span>
              <span className="text-xs font-mono text-indigo-600">
                {(r.similarity * 100).toFixed(0)}%
              </span>
            </div>
            {r.summary && (
              <p className="mt-0.5 text-xs text-slate-500">{truncate(r.summary, 100)}</p>
            )}
            {r.sentiment && (
              <div className="mt-1">
                <SentimentBadge sentiment={r.sentiment as never} />
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
