"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// A5: Form to add a new data source config.
export default function NewSourcePage() {
  const router = useRouter();
  const [adapter, setAdapter] = useState("github");
  const [label, setLabel] = useState("");
  const [configJson, setConfigJson] = useState('{\n  "owner": "vercel",\n  "repo": "next.js"\n}');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceKeyPreview = (() => {
    try {
      const cfg = JSON.parse(configJson);
      if (adapter === "github") return `github:${cfg.owner}/${cfg.repo}`;
      if (adapter === "reddit") return `reddit:r/${(cfg.subreddits ?? [])[0] ?? "?"}`;
      if (adapter === "rss") return `rss:${cfg.feedUrl ?? "?"}`;
      if (adapter === "csv") return `csv:upload`;
    } catch {
      // ignore
    }
    return "";
  })();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let config: unknown;
    try {
      config = JSON.parse(configJson);
    } catch {
      setError("Config is not valid JSON");
      return;
    }
    if (!label.trim()) {
      setError("Label is required");
      return;
    }
    if (!sourceKeyPreview) {
      setError("Could not derive source key from config");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceKey: sourceKeyPreview,
        label,
        adapter,
        config,
        enabled: true,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create source");
      return;
    }
    router.push("/sources");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold text-slate-900">Add Data Source</h1>
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <label className="text-sm font-medium text-slate-700">Adapter type</label>
          <select
            value={adapter}
            onChange={(e) => {
              setAdapter(e.target.value);
              if (e.target.value === "reddit") {
                setConfigJson('{\n  "subreddits": ["nextjs"],\n  "lookbackHours": 24,\n  "maxItems": 50\n}');
              } else if (e.target.value === "rss") {
                setConfigJson('{\n  "feedUrl": "https://example.com/feed.xml",\n  "lookbackHours": 48,\n  "maxItems": 50\n}');
              } else if (e.target.value === "github") {
                setConfigJson('{\n  "owner": "vercel",\n  "repo": "next.js"\n}');
              }
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="github">GitHub Issues</option>
            <option value="reddit">Reddit</option>
            <option value="rss">RSS / Atom feed</option>
            <option value="csv">CSV (upload only)</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. GitHub Issues — vercel/next.js"
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-slate-700">
            Config (JSON)
          </label>
          <textarea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-xs"
          />
          {sourceKeyPreview && (
            <p className="mt-1 text-xs text-slate-500">
              Source key: <code>{sourceKeyPreview}</code>
            </p>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create source"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
