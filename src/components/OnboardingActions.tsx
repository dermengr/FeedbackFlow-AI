"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      {showWelcomeComplete && (
        <button
          type="button"
          onClick={() => completeStep("welcome")}
          disabled={loading !== null}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading === "welcome" ? "Saving…" : "Complete welcome step"}
        </button>
      )}
      {showSkip && (
        <button
          type="button"
          onClick={skipOnboarding}
          disabled={loading !== null}
          className="text-sm text-slate-500 underline hover:text-slate-700"
        >
          {loading === "skip" ? "Skipping…" : "Skip onboarding"}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}