"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bookmark, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

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
    } catch {
      setViews([]);
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
    } catch {
      // keep form open so user can retry
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
    } catch {
      // ignore
    }
  };

  const cancelSave = () => {
    setNewName("");
    setShowSaveForm(false);
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center gap-2">
        <Bookmark className="h-4 w-4 text-slate-500" />
        <h2 className="text-sm font-semibold text-slate-900">Saved Views</h2>
      </div>

      <div className="space-y-1">
        {loading ? (
          <p className="px-2 py-1.5 text-sm text-slate-400">Loading…</p>
        ) : views.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-slate-400">No saved views yet.</p>
        ) : (
          views.map((view) => (
            <div
              key={view.id}
              className="group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              <button
                type="button"
                onClick={() => applyView(view)}
                className="flex-1 truncate text-left hover:text-slate-900"
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
                className="rounded p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-200 hover:text-red-600 group-hover:opacity-100"
                aria-label={`Delete ${view.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3">
        {showSaveForm ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="View name"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
                className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                type="button"
                onClick={cancelSave}
                className="rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
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
              "inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium",
              canSave
                ? "text-brand-700 hover:bg-brand-50"
                : "cursor-not-allowed text-slate-300"
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
