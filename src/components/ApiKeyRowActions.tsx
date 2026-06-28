"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/toast";

export function ApiKeyRowActions({ keyId }: { keyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/api-keys/${keyId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        showToast(data.error ?? "Failed to delete API key", "error");
        return;
      }
      router.refresh();
      showToast("API key deleted", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete API key", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-xs font-medium text-red-600 hover:text-red-800"
    >
      {loading ? "Revoking…" : "Revoke"}
    </button>
  );
}