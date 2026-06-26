"use client";

import { useCallback, useEffect, useState } from "react";

// Mirror of the WidgetDto returned by /api/widgets, plus the `data` payload
// enriched by the server.
interface WidgetData {
  type: string;
  counts?: Record<string, number>;
  distribution?: { severity: number; count: number }[];
  items?: {
    id: string;
    source: string;
    title: string | null;
    sentiment: string | null;
    severity: number | null;
    summary: string | null;
    status: string | null;
    originalTimestamp: string;
  }[];
  topics?: { topic: string; count: number }[];
  series?: { date: string; positive: number; neutral: number; negative: number }[];
}

interface Widget {
  id: string;
  type: string;
  title: string;
  config: unknown;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  data: WidgetData | null;
}

const WIDGET_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "sentiment_summary", label: "Sentiment Summary" },
  { value: "severity_distribution", label: "Severity Distribution" },
  { value: "recent_items", label: "Recent Items" },
  { value: "topic_breakdown", label: "Topic Breakdown" },
  { value: "trend_sparkline", label: "Trend Sparkline" },
];

const sentimentColor = (s: string | null): string => {
  if (s === "positive") return "text-emerald-600";
  if (s === "negative") return "text-red-600";
  if (s === "neutral") return "text-slate-600";
  return "text-slate-400";
};

// Render the body of a widget card based on its type/data.
function WidgetBody({ widget }: { widget: Widget }) {
  const data = widget.data;
  if (!data) {
    return <p className="text-sm text-slate-400">No data available.</p>;
  }

  switch (widget.type) {
    case "sentiment_summary": {
      const counts = data.counts ?? {};
      const entries = Object.entries(counts);
      if (entries.length === 0) {
        return <p className="text-sm text-slate-400">No analyses yet.</p>;
      }
      return (
        <ul className="space-y-1">
          {entries.map(([sentiment, count]) => (
            <li key={sentiment} className="flex items-center justify-between text-sm">
              <span className={`capitalize font-medium ${sentimentColor(sentiment)}`}>
                {sentiment}
              </span>
              <span className="text-slate-700">{count}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "severity_distribution": {
      const dist = data.distribution ?? [];
      if (dist.length === 0) {
        return <p className="text-sm text-slate-400">No analyses yet.</p>;
      }
      const max = Math.max(...dist.map((d) => d.count), 1);
      return (
        <ul className="space-y-1.5">
          {dist.map((d) => (
            <li key={d.severity} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Severity {d.severity}</span>
                <span className="text-slate-700">{d.count}</span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-indigo-500"
                  style={{ width: `${(d.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      );
    }
    case "recent_items": {
      const items = data.items ?? [];
      if (items.length === 0) {
        return <p className="text-sm text-slate-400">No recent items.</p>;
      }
      return (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-slate-700">
                  {it.title ?? it.source}
                </span>
                <span className={`shrink-0 text-xs ${sentimentColor(it.sentiment)}`}>
                  {it.sentiment ?? "—"}
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">
                {it.summary ?? "No summary"}
              </p>
            </li>
          ))}
        </ul>
      );
    }
    case "topic_breakdown": {
      const topics = data.topics ?? [];
      if (topics.length === 0) {
        return <p className="text-sm text-slate-400">No topics yet.</p>;
      }
      return (
        <ul className="space-y-1">
          {topics.slice(0, 8).map((t) => (
            <li key={t.topic} className="flex items-center justify-between text-sm">
              <span className="truncate text-slate-700">{t.topic}</span>
              <span className="text-slate-500">{t.count}</span>
            </li>
          ))}
        </ul>
      );
    }
    case "trend_sparkline": {
      const series = data.series ?? [];
      if (series.length === 0) {
        return <p className="text-sm text-slate-400">No trend data.</p>;
      }
      const max = Math.max(
        ...series.map((d) => d.positive + d.neutral + d.negative),
        1
      );
      return (
        <div className="flex h-16 items-end gap-1">
          {series.map((d) => {
            const total = d.positive + d.neutral + d.negative;
            const h = Math.max((total / max) * 100, 4);
            return (
              <div
                key={d.date}
                className="flex-1 rounded-t bg-indigo-400"
                style={{ height: `${h}%` }}
                title={`${d.date}: ${total} items`}
              />
            );
          })}
        </div>
      );
    }
    default:
      return <p className="text-sm text-slate-400">Unsupported widget type.</p>;
  }
}

export function WidgetGrid() {
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState(WIDGET_TYPE_OPTIONS[0].value);
  const [formTitle, setFormTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/widgets", { cache: "no-store" });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      const data = (await res.json()) as { widgets: Widget[] };
      setWidgets(data.widgets);
      setStatus("ready");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load widgets");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!formTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/widgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: formType, title: formTitle.trim() }),
      });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setShowForm(false);
      setFormTitle("");
      await load();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to add widget");
      setStatus("error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`/api/widgets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      setWidgets((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to remove widget");
      setStatus("error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Dashboard Widgets</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          Add Widget
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Type
              </span>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {WIDGET_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                Title
              </span>
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Widget title"
                className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={submitting || !formTitle.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add"}
            </button>
          </div>
        </div>
      )}

      {status === "loading" && (
        <p className="text-sm text-slate-400">Loading widgets…</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-600">{errorMsg}</p>
      )}

      {status === "ready" && widgets.length === 0 && (
        <p className="text-sm text-slate-400">
          No widgets yet. Click “Add Widget” to create one.
        </p>
      )}

      {widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {widgets.map((w) => (
            <div
              key={w.id}
              className="relative rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            >
              <button
                type="button"
                aria-label="Remove widget"
                onClick={() => handleRemove(w.id)}
                className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                ✕
              </button>
              <h3 className="pr-6 text-sm font-semibold text-slate-700">
                {w.title}
              </h3>
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-400">
                {w.type.replace(/_/g, " ")}
              </p>
              <WidgetBody widget={w} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
