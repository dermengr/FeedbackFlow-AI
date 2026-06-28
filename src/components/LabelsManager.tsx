"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { showToast } from "@/lib/toast";

type Label = {
  id: string;
  name: string;
  color: string;
};

const LABEL_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "emerald",
  "teal",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
] as const;

function badgeClasses(color: string) {
  switch (color) {
    case "slate":
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
    case "red":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    case "orange":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
    case "amber":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
    case "green":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "emerald":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
    case "teal":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300";
    case "blue":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    case "indigo":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300";
    case "violet":
      return "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300";
    case "purple":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
    case "pink":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300";
    default:
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  }
}

function dotClasses(color: string) {
  switch (color) {
    case "slate":
      return "bg-slate-500";
    case "red":
      return "bg-red-500";
    case "orange":
      return "bg-orange-500";
    case "amber":
      return "bg-amber-500";
    case "green":
      return "bg-green-500";
    case "emerald":
      return "bg-emerald-500";
    case "teal":
      return "bg-teal-500";
    case "blue":
      return "bg-blue-500";
    case "indigo":
      return "bg-indigo-500";
    case "violet":
      return "bg-violet-500";
    case "purple":
      return "bg-purple-500";
    case "pink":
      return "bg-pink-500";
    default:
      return "bg-slate-500";
  }
}

export function LabelsManager({ initialLabels }: { initialLabels: Label[] }) {
  const [labels, setLabels] = useState<Label[]>(initialLabels);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(LABEL_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, color }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Failed to create label";
        setError(message);
        showToast(message, "error", data.detail);
        return;
      }
      setLabels((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setColor(LABEL_COLORS[0]);
      showToast("Label created", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create label";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const label = labels.find((l) => l.id === id);
    if (!confirm(`Delete label "${label?.name}"? This cannot be undone.`)) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/labels/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Failed to delete label", "error", data.detail);
        return;
      }
      setLabels((prev) => prev.filter((l) => l.id !== id));
      showToast("Label deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete label", "error");
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-modern p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Create new label
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Labels help categorize feedback items.
        </p>

        <form onSubmit={handleCreate} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="label-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="label-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Bug"
              className="input-modern mt-1"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Color
            </span>
            <div className="mt-2 flex flex-wrap gap-2">
              {LABEL_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    color === c
                      ? "border-slate-900 dark:border-white"
                      : "border-transparent"
                  } ${dotClasses(c)}`}
                  aria-label={`Select ${c}`}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary">
            <Plus className="h-4 w-4" />
            {submitting ? "Creating…" : "Create label"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Existing labels
        </h2>
        {labels.length === 0 ? (
          <div className="card-modern mt-2 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No labels yet. Create one above to get started.
          </div>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-slate-700 dark:bg-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
              <thead className="bg-slate-50/80 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Name
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Color
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700 dark:text-slate-200">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {labels.map((label) => (
                  <tr
                    key={label.id}
                    className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-700/30"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${badgeClasses(
                          label.color
                        )}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${dotClasses(label.color)}`} />
                        {label.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-slate-500 dark:text-slate-400">
                      {label.color}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(label.id)}
                        disabled={deleting[label.id]}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {deleting[label.id] ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
