"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/toast";

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

export function RoutingRuleForm({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const topicsRaw = String(form.get("topics") ?? "").trim();
    const minSeverityRaw = String(form.get("minSeverity") ?? "").trim();
    const sentimentRaw = String(form.get("sentiment") ?? "").trim();

    const conditions: Record<string, unknown> = {};
    if (topicsRaw) {
      conditions.topics = topicsRaw
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    if (minSeverityRaw) {
      conditions.minSeverity = Number(minSeverityRaw);
    }
    if (sentimentRaw) {
      conditions.sentiment = sentimentRaw;
    }

    try {
      const res = await fetch("/api/routing-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") ?? "").trim(),
          assigneeId: String(form.get("assigneeId") ?? ""),
          priority: Number(form.get("priority") ?? 0) || 0,
          conditions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to create routing rule");
      }
      showToast("Routing rule created", "success");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create rule";
      setError(message);
      showToast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-modern p-5">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Create a routing rule</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        A rule matches when all of its conditions are met. Leave a field blank to ignore it.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Name</span>
            <input
              name="name"
              type="text"
              required
              maxLength={100}
              className="input-modern mt-1 block w-full"
              placeholder="e.g. Bug escalation"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Assignee</span>
            <select
              name="assigneeId"
              required
              className="input-modern mt-1 block w-full"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Topics (comma-separated)</span>
            <input
              name="topics"
              type="text"
              className="input-modern mt-1 block w-full"
              placeholder="e.g. Bug Report, Performance"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Min severity (1-5)</span>
            <input
              name="minSeverity"
              type="number"
              min={1}
              max={5}
              className="input-modern mt-1 block w-full"
              placeholder="e.g. 4"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Sentiment</span>
            <select
              name="sentiment"
              className="input-modern mt-1 block w-full"
            >
              <option value="">Any</option>
              <option value="positive">positive</option>
              <option value="neutral">neutral</option>
              <option value="negative">negative</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Priority (lower = higher)</span>
            <input
              name="priority"
              type="number"
              min={0}
              defaultValue={0}
              className="input-modern mt-1 block w-full"
            />
          </label>
        </div>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "Creating…" : "Create rule"}
        </button>
      </form>
    </div>
  );
}