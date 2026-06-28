"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { showToast } from "@/lib/toast";
import type { ExportTemplateDto, ExportFormat } from "@/lib/export-templates";

const AVAILABLE_FIELDS: { field: string; label: string }[] = [
  { field: "externalId", label: "External ID" },
  { field: "source", label: "Source" },
  { field: "title", label: "Title" },
  { field: "rawContent", label: "Raw Content" },
  { field: "sentiment", label: "Sentiment" },
  { field: "severityScore", label: "Severity" },
  { field: "status", label: "Status" },
  { field: "summary", label: "Summary" },
  { field: "createdAt", label: "Created" },
  { field: "originalTimestamp", label: "Original Timestamp" },
];

const FORMATS: ExportFormat[] = ["csv", "json", "tsv"];

export function ExportTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: ExportTemplateDto[];
}) {
  const [templates, setTemplates] = useState<ExportTemplateDto[]>(initialTemplates);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(["title", "source", "sentiment", "status", "createdAt"])
  );
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function toggleField(field: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }
    if (selected.size === 0) {
      setError("Select at least one column.");
      return;
    }

    const columns = AVAILABLE_FIELDS.filter((f) => selected.has(f.field)).map(
      (f) => ({ field: f.field, label: f.label })
    );

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/export/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, columns, format }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Failed to create export template";
        setError(message);
        showToast(message, "error", data.detail);
        return;
      }
      setTemplates((prev) => [data, ...prev]);
      setName("");
      setSelected(new Set(["title", "source", "sentiment", "status", "createdAt"]));
      setFormat("csv");
      showToast("Export template created", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create export template";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const template = templates.find((t) => t.id === id);
    if (
      !confirm(`Delete export template "${template?.name}"? This cannot be undone.`)
    )
      return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/export/templates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Failed to delete export template", "error", data.detail);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast("Export template deleted", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete export template",
        "error"
      );
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-modern p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Create export template
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Choose the columns you want included when exporting feedback.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="export-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="export-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Support summary"
              className="input-modern mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="export-format"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Format
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              className="input-modern mt-1"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Columns
            </span>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {AVAILABLE_FIELDS.map((field) => (
                <label
                  key={field.field}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700/50"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(field.field)}
                    onChange={() => toggleField(field.field)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary">
            <Plus className="h-4 w-4" />
            {submitting ? "Creating…" : "Create template"}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Saved export templates
        </h2>
        {templates.length === 0 ? (
          <div className="card-modern mt-2 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No export templates yet. Create one above to get started.
          </div>
        ) : (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="card-modern p-4 transition-all hover:-translate-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {template.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {template.format.toUpperCase()} · {template.columns.length} column
                      {template.columns.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(template.id)}
                    disabled={deleting[template.id]}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting[template.id] ? "Deleting…" : "Delete"}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {template.columns.map((col) => (
                    <span
                      key={col.field}
                      className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                    >
                      {col.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
