"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALLOWED_SCOPES } from "@/lib/api-key-constants";
import { showToast } from "@/lib/toast";

// Client-side form for creating a new API key. On success it displays the
// raw key once with a copy button and a warning that it cannot be retrieved
// again. The scopes are constrained to the server's ALLOWED_SCOPES list.
const SCOPE_LABELS: Record<string, string> = {
  "read:feedback": "read:feedback",
  "write:feedback": "write:feedback",
  "read:analytics": "read:analytics",
};

export function ApiKeyForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["read:feedback"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<{
    rawKey: string;
    name: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    setCreatedKey(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        const message = data.error || "Failed to create API key";
        setError(message);
        showToast(message, "error");
        return;
      }
      setCreatedKey({ rawKey: data.key.rawKey, name: data.key.name });
      setName("");
      setScopes(["read:feedback"]);
      onCreated?.();
      router.refresh();
      showToast("API key created", "success");
    } catch (err) {
      setError("Network error — please try again.");
      showToast(err instanceof Error ? err.message : "Failed to create API key", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyKey() {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast("API key copied", "success");
    } catch {
      // Clipboard may be unavailable; ignore.
      showToast("Failed to copy API key", "error");
    }
  }

  return (
    <div className="card-modern p-4">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Create new API key</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        Generate a key for programmatic access to the FeedbackFlow API.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="api-key-name"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Name
          </label>
          <input
            id="api-key-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. CI bot"
            className="input-modern mt-1"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">Scopes</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {ALLOWED_SCOPES.map((scope) => (
              <label
                key={scope}
                className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                />
                {SCOPE_LABELS[scope] ?? scope}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary"
        >
          {submitting ? "Generating…" : "Generate key"}
        </button>
      </form>

      {createdKey && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3 backdrop-blur-sm dark:bg-amber-900/20 dark:border-amber-700/50">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Key created: {createdKey.name}
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Copy your API key now. For security reasons, the full key will
                not be shown again.
              </p>
            </div>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition-colors hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <code className="mt-2 block break-all rounded-lg bg-white px-2 py-1.5 font-mono text-xs text-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {createdKey.rawKey}
          </code>
        </div>
      )}
    </div>
  );
}
