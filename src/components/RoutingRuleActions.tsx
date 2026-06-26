"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function EnabledToggle({
  ruleId,
  enabled,
}: {
  ruleId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      await fetch(`/api/routing-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      router.refresh();
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
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          enabled
            ? "bg-green-100 text-green-700 hover:bg-green-200"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
      >
        {enabled ? "Enabled" : "Disabled"}
      </button>
      <DeleteRuleButton ruleId={ruleId} />
    </div>
  );
}

function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Delete this routing rule?")) return;
    setLoading(true);
    try {
      await fetch(`/api/routing-rules/${ruleId}`, { method: "DELETE" });
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
      className="text-xs text-red-600 hover:text-red-800"
    >
      Delete
    </button>
  );
}