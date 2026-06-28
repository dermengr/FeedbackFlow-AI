"use client";

import { useEffect, useState } from "react";
import { PageShell, PageHeader, PageSection, AnimatedCard, AnimatedButton } from "@/components/PageShell";
import { SeverityBadge } from "@/components/Badges";
import { showToast } from "@/lib/toast";
import type { ImpactScoreResult } from "@/lib/impact";

interface FeedbackItem {
  id: string;
  title: string | null;
  source: string;
  originalTimestamp: string;
  analysis?: {
    severityScore: number;
  } | null;
}

interface ImpactRow extends FeedbackItem {
  impact: ImpactScoreResult;
}

export default function ImpactPage() {
  const [rows, setRows] = useState<ImpactRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/feedback?pageSize=50&sort=severity&order=desc", {
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Failed to load feedback: ${res.status}`);
      }
      const json = (await res.json()) as { items: FeedbackItem[] };
      const items = json.items ?? [];

      const impactResults = await Promise.all(
        items.map(async (item) => {
          try {
            const impactRes = await fetch(`/api/feedback/${encodeURIComponent(item.id)}/impact`, {
              cache: "no-store",
            });
            if (!impactRes.ok) {
              throw new Error(`Impact failed for ${item.id}: ${impactRes.status}`);
            }
            const impact = (await impactRes.json()) as ImpactScoreResult;
            return { ...item, impact };
          } catch (err) {
            showToast(
              "Impact load failed",
              "error",
              err instanceof Error ? err.message : undefined
            );
            return {
              ...item,
              impact: {
                score: 0,
                breakdown: { severity: 0, votes: 0, duplicates: 0, ageInDays: 0 },
              },
            };
          }
        })
      );

      impactResults.sort((a, b) => b.impact.score - a.impact.score);
      setRows(impactResults);
    } catch (err) {
      showToast(
        "Failed to load impact tracking",
        "error",
        err instanceof Error ? err.message : undefined
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Impact Tracking"
        description="Rank feedback items by their combined impact score across severity, votes, and duplicates."
      />

      <PageSection>
        <AnimatedCard className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing up to 50 items sorted by impact score.
            </p>
            <AnimatedButton onClick={load} className="btn-secondary" disabled={loading}>
              {loading ? "Refreshing…" : "Refresh"}
            </AnimatedButton>
          </div>
        </AnimatedCard>
      </PageSection>

      <PageSection>
        <AnimatedCard className="overflow-hidden p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4 text-right">Score</th>
                  <th className="py-2 pr-4 text-right">Severity</th>
                  <th className="py-2 pr-4 text-right">Votes</th>
                  <th className="py-2 pr-4 text-right">Duplicates</th>
                  <th className="py-2 text-right">Age (days)</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-slate-400">
                      {loading ? "Loading impact scores…" : "No feedback items found."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/50 dark:border-slate-700/50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-2 pr-4">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {row.title ?? "Untitled feedback"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {row.source}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <span className="font-bold text-brand-600">{row.impact.score}</span>
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {row.impact.breakdown.severity.toFixed(1)}
                          </span>
                          {row.analysis?.severityScore !== undefined && (
                            <SeverityBadge score={row.analysis.severityScore} />
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {row.impact.breakdown.votes.toFixed(1)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-700 dark:text-slate-300">
                        {row.impact.breakdown.duplicates.toFixed(1)}
                      </td>
                      <td className="py-2 text-right text-slate-700 dark:text-slate-300">
                        {row.impact.breakdown.ageInDays}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AnimatedCard>
      </PageSection>
    </PageShell>
  );
}
