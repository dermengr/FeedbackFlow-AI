"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { showToast } from "@/lib/toast";

export function OnboardingActions({
  showSkip,
  showWelcomeComplete,
}: {
  showSkip: boolean;
  showWelcomeComplete: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function completeStep(stepId: string) {
    setLoading(stepId);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to complete step");
      }
      router.refresh();
      showToast("Onboarding updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update onboarding";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(null);
    }
  }

  async function skipOnboarding() {
    setLoading("skip");
    setError(null);
    try {
      const res = await fetch("/api/onboarding", { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to skip onboarding");
      }
      router.refresh();
      showToast("Onboarding updated", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update onboarding";
      setError(message);
      showToast(message, "error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showWelcomeComplete && (
        <button
          type="button"
          onClick={() => completeStep("welcome")}
          disabled={loading !== null}
          className="btn-primary"
        >
          {loading === "welcome" ? "Saving…" : "Complete welcome step"}
        </button>
      )}
      {showSkip && (
        <button
          type="button"
          onClick={skipOnboarding}
          disabled={loading !== null}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          {loading === "skip" ? "Skipping…" : "Skip onboarding"}
        </button>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </div>
  );
}