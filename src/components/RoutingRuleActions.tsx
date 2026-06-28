"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/toast";

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
      const res = await fetch(`/api/routing-rules/${ruleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (!res.ok) throw new Error("Failed to update rule");
      showToast(`Rule ${enabled ? "disabled" : "enabled"}`, "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update rule", "error");
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
        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
          enabled
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
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
      const res = await fetch(`/api/routing-rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete rule");
      showToast("Rule deleted", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to delete rule", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-rose-600 transition-colors hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
    >
      Delete
    </button>
  );
}