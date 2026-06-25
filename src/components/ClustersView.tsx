"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SentimentBadge, SeverityBadge, StatusBadge } from "@/components/Badges";
import { Layers, Loader2 } from "lucide-react";

interface ClusterMember {
  id: string;
  title: string | null;
  externalId: string;
  source: string;
  sentiment: string | null;
  severity: number | null;
  status: string | null;
}

interface Cluster {
  size: number;
  members: ClusterMember[];
}

interface ClustersResponse {
  clusters: Cluster[];
  enabled: boolean;
  count: number;
  totalItems: number;
  threshold: number;
}

export function ClustersView() {
  const [data, setData] = useState<ClustersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(0.85);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/feedback/clusters?threshold=${threshold}&minSize=2`)
      .then((r) => r.json())
      .then((d: ClustersResponse) => {
        if (active) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [threshold]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Computing clusters...</span>
      </div>
    );
  }

  if (data && !data.enabled) {
    return (
      <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">
        Semantic clustering requires embeddings. Set <code>OPENAI_API_KEY</code> to enable.
      </div>
    );
  }

  if (data && data.clusters.length === 0) {
    return (
      <div className="rounded-md bg-slate-50 p-6 text-center text-sm text-slate-500">
        No clusters found at threshold {threshold}. Try lowering the similarity threshold.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Threshold slider */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-700">
          Similarity threshold: {threshold.toFixed(2)}
        </label>
        <input
          type="range"
          min="0.5"
          max="0.95"
          step="0.05"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="w-48"
        />
        {data && (
          <span className="text-xs text-slate-500">
            {data.count} cluster{data.count === 1 ? "" : "s"} from {data.totalItems} items
          </span>
        )}
      </div>

      {/* Clusters */}
      <div className="space-y-3">
        {data?.clusters.map((cluster, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-2 flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <span className="text-sm font-semibold text-slate-700">
                Cluster {i + 1}
              </span>
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {cluster.size} item{cluster.size === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {cluster.members.map((m) => (
                <li key={m.id} className="py-2">
                  <Link
                    href={`/inbox/${m.id}`}
                    className="flex flex-wrap items-center gap-2 hover:underline"
                  >
                    <span className="font-medium text-slate-800">
                      {m.title ?? m.externalId}
                    </span>
                    {m.sentiment && <SentimentBadge sentiment={m.sentiment as never} />}
                    {m.severity != null && <SeverityBadge score={m.severity} />}
                    {m.status && <StatusBadge status={m.status as never} />}
                  </Link>
                  <div className="mt-0.5 text-xs text-slate-400">
                    {m.source}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
