"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { showToast } from "@/lib/toast";
import type { TemplateDto } from "@/lib/reply-templates";

export function ReplyTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: TemplateDto[];
}) {
  const [templates, setTemplates] = useState<TemplateDto[]>(initialTemplates);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setName("");
    setSubject("");
    setBody("");
    setTags("");
    setEditingId(null);
    setError(null);
  }

  function startEdit(template: TemplateDto) {
    setName(template.name);
    setSubject(template.subject ?? "");
    setBody(template.body);
    setTags(template.tags.join(", "));
    setEditingId(template.id);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedBody = body.trim();
    if (!trimmedName || !trimmedBody) {
      setError("Name and body are required.");
      return;
    }

    const payload = {
      name: trimmedName,
      subject: subject.trim() || null,
      body: trimmedBody,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    setSubmitting(true);
    setError(null);
    try {
      const url = editingId
        ? `/api/reply-templates/${editingId}`
        : "/api/reply-templates";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || `Failed to ${editingId ? "update" : "create"} template`;
        setError(message);
        showToast(message, "error", data.detail);
        return;
      }

      const updatedTemplate: TemplateDto = editingId
        ? data.template
        : data.template;
      setTemplates((prev) => {
        if (editingId) {
          return prev
            .map((t) => (t.id === editingId ? updatedTemplate : t))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        }
        return [updatedTemplate, ...prev];
      });
      resetForm();
      showToast(
        editingId ? "Reply template updated" : "Reply template created",
        "success"
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : `Failed to ${editingId ? "update" : "create"} template`;
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!confirm(`Delete template "${template?.name}"? This cannot be undone.`))
      return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/reply-templates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error || "Failed to delete template", "error", data.detail);
        return;
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (editingId === id) resetForm();
      showToast("Reply template deleted", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete template",
        "error"
      );
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="card-modern p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {editingId ? "Edit reply template" : "Create reply template"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Save reusable replies with placeholders like {"{{customerName}}"}.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary py-1.5 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="template-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Name
            </label>
            <input
              id="template-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Thanks for feedback"
              className="input-modern mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="template-subject"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Subject (optional)
            </label>
            <input
              id="template-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              placeholder="e.g. Thanks for reaching out"
              className="input-modern mt-1"
            />
          </div>

          <div>
            <label
              htmlFor="template-body"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Body
            </label>
            <textarea
              id="template-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write your reply template here…"
              className="input-modern mt-1 min-h-[120px]"
            />
          </div>

          <div>
            <label
              htmlFor="template-tags"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300"
            >
              Tags (comma separated)
            </label>
            <input
              id="template-tags"
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. thanks, follow-up"
              className="input-modern mt-1"
            />
          </div>

          {error && (
            <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary">
            {editingId ? (
              <>
                <Save className="h-4 w-4" />
                {submitting ? "Saving…" : "Save changes"}
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {submitting ? "Creating…" : "Create template"}
              </>
            )}
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Saved templates
        </h2>
        {templates.length === 0 ? (
          <div className="card-modern mt-2 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            No reply templates yet. Create one above to get started.
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
                    {template.subject && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {template.subject}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(template)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                      aria-label={`Edit ${template.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(template.id)}
                      disabled={deleting[template.id]}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                      aria-label={`Delete ${template.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-400">
                  {template.body}
                </p>

                {template.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
