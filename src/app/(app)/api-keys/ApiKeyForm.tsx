"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ALLOWED_SCOPES } from "@/lib/api-key-constants";

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
        setError(data.error || "Failed to create API key");
        return;
      }
      setCreatedKey({ rawKey: data.key.rawKey, name: data.key.name });
      setName("");
      setScopes(["read:feedback"]);
      onCreated?.();
      router.refresh();
    } catch {
      setError("Network error — please try again.");
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
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-800">Create new API key</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Generate a key for programmatic access to the FeedbackFlow API.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label
            htmlFor="api-key-name"
            className="block text-xs font-medium text-slate-700"
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
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div>
          <span className="block text-xs font-medium text-slate-700">Scopes</span>
          <div className="mt-1 flex flex-wrap gap-3">
            {ALLOWED_SCOPES.map((scope) => (
              <label
                key={scope}
                className="inline-flex items-center gap-1.5 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                {SCOPE_LABELS[scope] ?? scope}
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Generating…" : "Generate key"}
        </button>
      </form>

      {createdKey && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Key created: {createdKey.name}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Copy your API key now. For security reasons, the full key will
                not be shown again.
              </p>
            </div>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <code className="mt-2 block break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-slate-800">
            {createdKey.rawKey}
          </code>
        </div>
      )}
    </div>
  );
}
