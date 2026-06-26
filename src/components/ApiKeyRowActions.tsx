"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
        alert(data.error ?? "Failed to revoke key");
        return;
      }
      router.refresh();
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