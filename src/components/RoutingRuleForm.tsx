"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Create a routing rule</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        A rule matches when all of its conditions are met. Leave a field blank to ignore it.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Name</span>
            <input
              name="name"
              type="text"
              required
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Bug escalation"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Assignee</span>
            <select
              name="assigneeId"
              required
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Topics (comma-separated)</span>
            <input
              name="topics"
              type="text"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. Bug Report, Performance"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Min severity (1-5)</span>
            <input
              name="minSeverity"
              type="number"
              min={1}
              max={5}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. 4"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Sentiment</span>
            <select
              name="sentiment"
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Any</option>
              <option value="positive">positive</option>
              <option value="neutral">neutral</option>
              <option value="negative">negative</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Priority (lower = higher)</span>
            <input
              name="priority"
              type="number"
              min={0}
              defaultValue={0}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create rule"}
        </button>
      </form>
    </div>
  );
}