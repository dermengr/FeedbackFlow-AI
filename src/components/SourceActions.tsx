"use client";

import { useState } from "react";
import { showToast } from "@/lib/toast";

// A5: Client-side actions for the sources page.
// Handles Run-all, per-source enable/disable, and delete — replacing the
// previous inline onClick-in-server-component and <script> hack.
export function RunAllButton() {
  const [busy, setBusy] = useState(false);
  async function runAll() {
    setBusy(true);
    try {
      const res = await fetch("/api/ingest?multi=1", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to run sources", "error");
        return;
      }
      showToast("Source run started", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to run sources", "error");
    } finally {
      window.location.reload();
    }
  }
  return (
    <button
      disabled={busy}
      onClick={runAll}
      className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
    >
      {busy ? "Running…" : "Run all"}
    </button>
  );
}

// D22: Retry button for the ingest logs admin page.
export function RetryIngestButton() {
  const [busy, setBusy] = useState(false);
  async function retry() {
    setBusy(true);
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to run source", "error");
        return;
      }
      showToast("Source run started", "success");
    } catch (err) {
      console.error(err);
      showToast(err instanceof Error ? err.message : "Failed to run source", "error");
    } finally {
      window.location.reload();
    }
  }
  return (
    <button
      disabled={busy}
      onClick={retry}
      className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
    >
      {busy ? "Running…" : "Retry ingest"}
    </button>
  );
}

export function SourceRowActions({
  sourceId,
  enabled,
}: {
  sourceId: string;
  enabled: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to update source", "error");
        return;
      }
      showToast("Source updated", "success");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update source", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this source?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sources/${sourceId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to delete source", "error");
        return;
      }
      showToast("Source deleted", "success");
      window.location.reload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete source", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={busy}
        onClick={toggle}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-60"
      >
        {enabled ? "Disable" : "Enable"}
      </button>
      <button
        disabled={busy}
        onClick={remove}
        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
      >
        Delete
      </button>
    </div>
  );
}
