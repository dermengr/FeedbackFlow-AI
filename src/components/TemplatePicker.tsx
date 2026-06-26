"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  subject?: string | null;
  body: string;
  tags?: string[];
}

interface TemplatePickerProps {
  onApply: (body: string) => void;
}

// TemplatePicker — a dropdown button that lists the current user's saved reply
// templates. A search box filters the list by name/body/tags substring.
// Clicking a template calls onApply with the template body.
export function TemplatePicker({ onApply }: TemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch templates whenever the dropdown is opened (keeps the list fresh).
  const fetchTemplates = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/reply-templates${
        q.trim() ? `?query=${encodeURIComponent(q)}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load templates");
      }
      const data = await res.json();
      setTemplates((Array.isArray(data) ? data : data.templates ?? []) as Template[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the full list once on mount so the button can show a count.
  useEffect(() => {
    fetchTemplates("");
  }, [fetchTemplates]);

  // Close the dropdown on outside clicks.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Debounced search while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => fetchTemplates(query), 200);
    return () => clearTimeout(handle);
  }, [open, query, fetchTemplates]);

  const filtered = useMemo(() => {
    // The API already filters, but we also filter client-side for snappy UX
    // between debounced requests.
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => {
      const inName = t.name.toLowerCase().includes(q);
      const inBody = t.body.toLowerCase().includes(q);
      const inTags = (t.tags ?? []).some((tag) =>
        tag.toLowerCase().includes(q)
      );
      return inName || inBody || inTags;
    });
  }, [templates, query]);

  const handleSelect = (template: Template) => {
    onApply(template.body);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Reply template
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          <div className="border-b border-slate-100 p-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className={cn(
                "w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-700",
                "placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400",
              )}
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-auto py-1">
            {error ? (
              <p className="px-3 py-2 text-xs text-red-600" role="alert">
                {error}
              </p>
            ) : loading ? (
              <p className="px-3 py-2 text-xs text-slate-400">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">
                No templates found.
              </p>
            ) : (
              filtered.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleSelect(template)}
                  className={cn(
                    "flex w-full flex-col items-start px-3 py-2 text-left hover:bg-indigo-50",
                  )}
                  role="option"
                  aria-selected={false}
                >
                  <span className="text-sm font-medium text-slate-800">
                    {template.name}
                  </span>
                  {template.subject ? (
                    <span className="text-xs text-slate-500">
                      {template.subject}
                    </span>
                  ) : null}
                  <span className="line-clamp-2 text-xs text-slate-400">
                    {template.body}
                  </span>
                  {template.tags && template.tags.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {template.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700"
                        >
                          {tag}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
