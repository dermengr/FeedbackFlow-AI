"use client";

import { useState, useEffect, useCallback } from "react";

const RELATION_TYPES = ["duplicate", "related", "blocks", "blocked_by"] as const;
type RelationType = (typeof RELATION_TYPES)[number];

type LinkedItemSummary = {
  id: string;
  title: string | null;
  source: string;
};

type FeedbackLinkRecord = {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationType: string;
  createdById: string;
  createdAt: string;
  item: LinkedItemSummary;
  direction: "from" | "to";
};

type LinksResult = {
  linksFrom: FeedbackLinkRecord[];
  linksTo: FeedbackLinkRecord[];
};

const RELATION_LABELS: Record<string, string> = {
  duplicate: "Duplicates",
  related: "Related",
  blocks: "Blocks",
  blocked_by: "Blocked by",
};

export function FeedbackLinks({ feedbackItemId }: { feedbackItemId: string }) {
  const [links, setLinks] = useState<LinksResult>({
    linksFrom: [],
    linksTo: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-link form state
  const [relationType, setRelationType] = useState<RelationType>("related");
  const [toItemId, setToItemId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/links`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to load links" }));
        throw new Error(data.error ?? "Failed to load links");
      }
      const data = (await res.json()) as LinksResult;
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load links");
    } finally {
      setLoading(false);
    }
  }, [feedbackItemId]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    const target = toItemId.trim();
    if (!target || submitting) return;
    if (target === feedbackItemId) {
      setFormError("Cannot link an item to itself");
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toItemId: target, relationType }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to add link" }));
        throw new Error(data.error ?? "Failed to add link");
      }
      setToItemId("");
      await loadLinks();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to add link");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteLink(linkId: string) {
    try {
      const res = await fetch(
        `/api/feedback/${feedbackItemId}/links?linkId=${encodeURIComponent(linkId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to remove link" }));
        throw new Error(data.error ?? "Failed to remove link");
      }
      await loadLinks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove link");
    }
  }

  // Group all links by relation type. Direction is shown as a suffix.
  const allLinks = [...links.linksFrom, ...links.linksTo];
  const grouped: Record<string, FeedbackLinkRecord[]> = {};
  for (const l of allLinks) {
    if (!grouped[l.relationType]) grouped[l.relationType] = [];
    grouped[l.relationType].push(l);
  }

  const relationOrder: string[] = Array.from(
    new Set([...RELATION_TYPES, ...Object.keys(grouped)])
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Feedback Links</h2>

      <div className="mt-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading links…</p>
        ) : error && allLinks.length === 0 ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : allLinks.length === 0 ? (
          <p className="text-sm text-slate-500">No links yet.</p>
        ) : (
          relationOrder
            .filter((rt) => grouped[rt]?.length)
            .map((rt) => (
              <div key={rt}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {RELATION_LABELS[rt] ?? rt}
                </h3>
                <ul className="mt-2 space-y-2">
                  {grouped[rt].map((l) => (
                    <li
                      key={l.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <a
                          href={`/feedback/${l.item.id}`}
                          className="block truncate text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                          title={l.item.title ?? l.item.id}
                        >
                          {l.item.title ?? l.item.id}
                        </a>
                        <span className="text-xs text-slate-500">
                          {l.item.source} · {l.direction === "from" ? "outgoing" : "incoming"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void deleteLink(l.id)}
                        className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-rose-300 hover:text-rose-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
        )}
      </div>

      <form onSubmit={addLink} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-800">Add a link</h3>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={relationType}
            onChange={(e) => setRelationType(e.target.value as RelationType)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {RELATION_TYPES.map((rt) => (
              <option key={rt} value={rt}>
                {RELATION_LABELS[rt] ?? rt}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={toItemId}
            onChange={(e) => setToItemId(e.target.value)}
            placeholder="Target feedback item ID"
            className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={submitting || toItemId.trim().length === 0}
            className="shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Linking…" : "Link"}
          </button>
        </div>
        {formError && <p className="text-xs text-rose-600">{formError}</p>}
        {error && allLinks.length > 0 && (
          <p className="text-xs text-rose-600">{error}</p>
        )}
      </form>
    </section>
  );
}
