"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

type SavedView = {
  id: string;
  name: string;
  query: string;
  createdAt: string;
};

export function SavedViewsSidebar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [views, setViews] = useState<SavedView[]>([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const currentQuery = searchParams.toString();
  const canSave = currentQuery.length > 0;

  const fetchViews = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/views", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load views");
      const data = await res.json();
      setViews(Array.isArray(data.views) ? data.views : []);
    } catch (err) {
      setViews([]);
      showToast(err instanceof Error ? err.message : "Failed to load views", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  const saveView = async () => {
    const name = newName.trim();
    if (!name || !canSave) return;
    try {
      setSaving(true);
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, query: currentQuery }),
      });
      if (!res.ok) throw new Error("Failed to save view");
      setNewName("");
      setShowSaveForm(false);
      await fetchViews();
      showToast("View saved", "success");
    } catch (err) {
      // keep form open so user can retry
      showToast(err instanceof Error ? err.message : "Failed to save view", "error");
    } finally {
      setSaving(false);
    }
  };

  const applyView = (view: SavedView) => {
    router.push(`/inbox?${view.query}`);
  };

  const deleteView = async (id: string) => {
    try {
      const res = await fetch(`/api/views/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete view");
      await fetchViews();
      showToast("View deleted", "success");
    } catch (err) {
      // ignore
      showToast(err instanceof Error ? err.message : "Failed to delete view", "error");
    }
  };

  const cancelSave = () => {
    setNewName("");
    setShowSaveForm(false);
  };

  return (
    <section className="card-modern p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-slate-500 dark:text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Saved Views</h2>
      </div>

      <div className="space-y-1">
        {loading ? (
          <p className="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500">Loading…</p>
        ) : views.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-slate-400 dark:text-slate-500">No saved views yet.</p>
        ) : (
          views.map((view) => (
            <div
              key={view.id}
              className="group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <button
                type="button"
                onClick={() => applyView(view)}
                className="flex-1 truncate text-left transition-colors hover:text-slate-900 dark:hover:text-slate-100"
                title={view.name}
              >
                {view.name}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView(view.id);
                }}
                className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-slate-600 dark:hover:text-rose-400"
                aria-label={`Delete ${view.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        {showSaveForm ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="View name"
              className="input-modern w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") saveView();
                if (e.key === "Escape") cancelSave();
              }}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={saveView}
                disabled={!newName.trim() || saving}
                className="btn-primary py-1.5 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={cancelSave}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowSaveForm(true)}
            disabled={!canSave}
            className={cn(
              "inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
              canSave
                ? "text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-900/20"
                : "cursor-not-allowed text-slate-300 dark:text-slate-600"
            )}
            title={canSave ? "Save current view" : "Apply filters to save a view"}
          >
            <Plus className="h-3.5 w-3.5" />
            Save current view
          </button>
        )}
      </div>
    </section>
  );
}
