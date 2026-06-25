"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Github, Loader2, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";

// GitHub repository link submit form.
// Accepts a GitHub URL, shows a live preview of the parsed owner/repo,
// optionally validates the repo exists, and creates a SourceConfig.
export function GitHubRepoForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [validate, setValidate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  // Live preview of parsed owner/repo (client-side only, no API call)
  const preview = useMemo(() => {
    if (!url.trim()) return null;
    try {
      // Inline lightweight parse for preview (matches the server-side parser)
      const raw = url.trim();
      let owner: string | undefined;
      let repo: string | undefined;

      const sshMatch = raw.match(/^git@github\.com:([^/]+)\/([^/]+)/);
      if (sshMatch) {
        owner = sshMatch[1];
        repo = sshMatch[2];
      }

      if (!owner) {
        try {
          const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
          if (u.hostname === "github.com" || u.hostname === "www.github.com") {
            const parts = u.pathname.split("/").filter(Boolean);
            if (parts.length >= 2) {
              owner = parts[0];
              repo = parts[1];
            }
          }
        } catch {
          // ignore
        }
      }

      if (!owner) {
        const shorthand = raw.match(/^([^/\s]+)\/([^/\s]+)$/);
        if (shorthand) {
          owner = shorthand[1];
          repo = shorthand[2];
        }
      }

      if (owner && repo) {
        repo = repo.replace(/\.git$/, "");
        return { owner, repo };
      }
    } catch {
      // ignore
    }
    return null;
  }, [url]);

  async function testConnection() {
    if (!preview) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/sources/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          label: label || `GitHub Issues — ${preview.owner}/${preview.repo}`,
          validate: true,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `Repository ${preview.owner}/${preview.repo} is valid and source created!`,
        });
        // Redirect to sources page after successful creation
        setTimeout(() => {
          router.push("/sources");
          router.refresh();
        }, 800);
      } else if (res.status === 409) {
        setTestResult({
          ok: false,
          message: data.error ?? "This repository is already configured.",
        });
      } else if (data.repoExists === false) {
        setTestResult({
          ok: false,
          message: data.error ?? "Repository not found or not accessible.",
        });
      } else {
        setTestResult({
          ok: false,
          message: data.error ?? "Failed to create source.",
        });
      }
    } catch {
      setTestResult({
        ok: false,
        message: "Network error. Please try again.",
      });
    } finally {
      setTesting(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview) {
      setError("Please enter a valid GitHub repository URL");
      return;
    }
    setSubmitting(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/sources/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          label: label || `GitHub Issues — ${preview.owner}/${preview.repo}`,
          validate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/sources");
        router.refresh();
      } else if (res.status === 409) {
        setError(data.error ?? "This repository is already configured.");
      } else {
        setError(data.error ?? "Failed to create source.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {/* URL input */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          GitHub repository URL
        </label>
        <div className="mt-1 flex items-center gap-2">
          <div className="relative flex-1">
            <Github className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setTestResult(null);
                setError(null);
              }}
              placeholder="https://github.com/owner/repo"
              className="block w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Paste a GitHub URL, SSH URL, or <code>owner/repo</code> shorthand.
        </p>
      </div>

      {/* Live preview */}
      {preview && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-indigo-500" />
            <span className="text-slate-600">Detected repository:</span>
            <span className="font-semibold text-indigo-700">
              {preview.owner}/{preview.repo}
            </span>
          </div>
        </div>
      )}

      {/* Label (optional) */}
      <div>
        <label className="text-sm font-medium text-slate-700">
          Label <span className="text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={
            preview
              ? `GitHub Issues — ${preview.owner}/${preview.repo}`
              : "Auto-generated from URL"
          }
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Validate checkbox */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="validate-repo"
          checked={validate}
          onChange={(e) => setValidate(e.target.checked)}
          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label htmlFor="validate-repo" className="text-sm text-slate-600">
          Verify repository exists before creating
        </label>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-sm ${
            testResult.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{testResult.message}</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting || !preview}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Github className="h-4 w-4" />
              Add repository
            </>
          )}
        </button>
        <button
          type="button"
          onClick={testConnection}
          disabled={testing || !preview}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            "Test & create"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
