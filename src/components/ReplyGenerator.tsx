"use client";

import { useState } from "react";
import { TemplatePicker } from "@/components/TemplatePicker";

/**
 * Auto-Reply Generator.
 *
 * A "Generate Reply" button that calls the local LLM (via
 * /api/feedback/:id/reply) to produce a suggested support reply for a feedback
 * item. The generated reply is shown in an editable textarea with a "Copy"
 * button.
 */
export function ReplyGenerator({ feedbackItemId }: { feedbackItemId: string }) {
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to generate reply" }));
        throw new Error(data.error ?? "Failed to generate reply");
      }
      const data = (await res.json()) as { reply: string };
      setReply(data.reply);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate reply");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!reply) return;
    try {
      await navigator.clipboard.writeText(reply);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy to clipboard");
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Auto-Reply Generator
        </h2>
        <div className="flex items-center gap-2">
          <TemplatePicker onApply={(body) => setReply(body)} />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Generating…" : "Generate Reply"}
        </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {(loading || reply) && (
        <div className="mt-3 space-y-2">
          <textarea
            value={loading && !reply ? "Generating reply…" : reply}
            onChange={(e) => setReply(e.target.value)}
            rows={6}
            placeholder="Generated reply will appear here…"
            className="w-full resize-y rounded-md border border-slate-300 p-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="flex items-center justify-end gap-2">
            {copied && (
              <span className="text-xs text-emerald-600">Copied!</span>
            )}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!reply || loading}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
