"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";
import { showToast } from "@/lib/toast";

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
      const message = data.error ?? "Failed to create source";
      setError(message);
      showToast(message, "error");
      return;
    }
    showToast("Source created", "success");
    router.push("/sources");
    router.refresh();
  }

  return (
    <PageShell className="mx-auto max-w-lg space-y-4">
      <PageHeader title="Add Data Source" />
      <PageSection>
        <form onSubmit={submit} className="space-y-4 card-modern p-4">
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
            className="input-modern mt-1 block w-full"
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
            className="input-modern mt-1 block w-full"
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
            className="input-modern mt-1 block w-full font-mono text-xs"
          />
          {sourceKeyPreview && (
            <p className="mt-1 text-xs text-slate-500">
              Source key: <code>{sourceKeyPreview}</code>
            </p>
          )}
        </div>
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary"
          >
            {submitting ? "Creating..." : "Create source"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>
      </form>
    </PageSection>
  </PageShell>
  );
}
