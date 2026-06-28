"use client";

import { useState } from "react";
import { showToast } from "@/lib/toast";

export function WebhookTestButton({ webhookId }: { webhookId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleTest() {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${webhookId}/test`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Test failed (${res.status})`);
      }
      const data = (await res.json()) as { statusCode?: number };
      showToast(
        "Test ping sent",
        "success",
        data.statusCode ? `Endpoint responded ${data.statusCode}` : undefined
      );
    } catch (err) {
      showToast(
        "Test ping failed",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleTest}
      disabled={loading}
      className="btn-secondary py-1.5 text-xs disabled:opacity-50"
    >
      {loading ? "Testing…" : "Test"}
    </button>
  );
}
