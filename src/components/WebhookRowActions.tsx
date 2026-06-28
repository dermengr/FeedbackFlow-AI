"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/toast";

export function WebhookRowActions({
  webhookId,
  enabled,
}: {
  webhookId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to update webhook", "error");
        return;
      }
      router.refresh();
      showToast("Webhook updated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update webhook", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this webhook?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to delete webhook", "error");
        return;
      }
      router.refresh();
      showToast("Webhook deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete webhook", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`rounded px-1.5 py-0.5 text-xs ${
          enabled
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading}
        className="text-xs text-red-600 hover:text-red-800"
      >
        Delete
      </button>
    </div>
  );
}