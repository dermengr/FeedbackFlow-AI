"use client";

import { useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import Link from "next/link";
import { showToast } from "@/lib/toast";
import type { SavedViewDto } from "@/lib/views";

export function SavedViewsManager({
  initialViews,
}: {
  initialViews: SavedViewDto[];
}) {
  const [views, setViews] = useState<SavedViewDto[]>(initialViews);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  async function handleDelete(id: string) {
    const view = views.find((v) => v.id === id);
    if (!confirm(`Delete saved view "${view?.name}"? This cannot be undone.`))
      return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/views/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Failed to delete view", "error", data.detail);
        return;
      }
      setViews((prev) => prev.filter((v) => v.id !== id));
      showToast("Saved view deleted", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete view",
        "error"
      );
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div>
      {views.length === 0 ? (
        <div className="card-modern p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No saved views yet. Apply filters in the inbox and save the current
          view from the sidebar.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Name
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Query
                </th>
                <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {views.map((view) => (
                <tr
                  key={view.id}
                  className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                >
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                    {view.name}
                  </td>
                  <td className="px-4 py-3">
                    <code className="block max-w-xs truncate rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                      {view.query}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/inbox?${view.query}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Apply
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDelete(view.id)}
                        disabled={deleting[view.id]}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleting[view.id] ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
