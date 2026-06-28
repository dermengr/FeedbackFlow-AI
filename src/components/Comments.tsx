"use client";

import { useState, useEffect, useCallback } from "react";
import { formatDate } from "@/lib/utils";
import { showToast } from "@/lib/toast";

type Author = {
  id: string;
  name: string | null;
  email: string;
};

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
};

const MAX_BODY = 5000;

export function Comments({ feedbackItemId }: { feedbackItemId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/comments`, {
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to load comments" }));
        throw new Error(data.error ?? "Failed to load comments");
      }
      const data = (await res.json()) as { comments: Comment[] };
      setComments(data.comments);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load comments";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [feedbackItemId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const body = newComment.trim();
    if (!body || submitting) return;
    if (body.length > MAX_BODY) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Failed to add comment" }));
        throw new Error(data.error ?? "Failed to add comment");
      }
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setNewComment("");
      showToast("Comment posted", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to post comment";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  const display = (c: Comment) => c.author.name ?? c.author.email;
  const initial = (c: Comment) => {
    const name = display(c);
    return name.charAt(0).toUpperCase() || "?";
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-base font-semibold text-slate-900">Comments</h2>

      <div className="mt-4 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading comments…</p>
        ) : error && comments.length === 0 ? (
          <p className="text-sm text-rose-600">{error}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="flex gap-3 rounded-md border border-slate-100 bg-slate-50 p-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {initial(c)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {display(c)}
                  </span>
                  <span className="text-xs text-slate-500">
                    {formatDate(c.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {c.body}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={submitComment} className="mt-4 space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          maxLength={MAX_BODY}
          rows={3}
          placeholder="Write a comment…"
          className="w-full resize-y rounded-md border border-slate-300 p-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {newComment.length}/{MAX_BODY}
          </span>
          <button
            type="submit"
            disabled={submitting || newComment.trim().length === 0}
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add comment"}
          </button>
        </div>
        {error && comments.length > 0 && (
          <p className="text-xs text-rose-600">{error}</p>
        )}
      </form>
    </section>
  );
}
