import Link from "next/link";
import { Check } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  ONBOARDING_STEPS,
  getOnboardingState,
  getOnboardingProgress,
} from "@/lib/onboarding";
import { OnboardingActions } from "@/components/OnboardingActions";

export const dynamic = "force-dynamic";

// Map each onboarding step id to a destination page the user can visit to
// complete that step.
const STEP_LINKS: Record<string, string> = {
  welcome: "/onboarding",
  create_source: "/sources/new",
  run_ingest: "/sources",
  view_dashboard: "/dashboard",
  review_inbox: "/inbox",
};

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const [state, progress] = await Promise.all([
    getOnboardingState(session.user.id),
    getOnboardingProgress(session.user.id),
  ]);

  const completed = new Set(state.completedSteps);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Onboarding Wizard</h1>
        <p className="text-sm text-slate-500">
          Complete these steps to get FeedbackFlow up and running.
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">
            {progress.completionPercentage}% complete
          </span>
          {state.skipped ? (
            <span className="text-slate-400">Onboarding skipped</span>
          ) : progress.nextStep === null ? (
            <span className="text-indigo-600">All steps complete</span>
          ) : (
            <span className="text-slate-500">
              Next: {ONBOARDING_STEPS.find((s) => s.id === progress.nextStep)?.title}
            </span>
          )}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progress.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <ol className="space-y-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completed.has(step.id);
          const isCurrent = state.currentStep === step.id && !isCompleted;
          const href = STEP_LINKS[step.id] ?? "/onboarding";

          return (
            <li key={step.id}>
              <Link
                href={href}
                className={[
                  "flex items-center gap-4 rounded-lg border p-4 transition-colors",
                  isCurrent
                    ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200"
                    : isCompleted
                    ? "border-slate-200 bg-white hover:border-slate-300"
                    : "border-slate-200 bg-white hover:border-slate-300",
                ].join(" ")}
              >
                {/* Status indicator */}
                <div
                  className={[
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    isCompleted
                      ? "bg-indigo-600 text-white"
                      : isCurrent
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Title + status */}
                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-sm font-medium",
                      isCurrent ? "text-indigo-900" : "text-slate-900",
                    ].join(" ")}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isCompleted
                      ? "Completed"
                      : isCurrent
                      ? "In progress"
                      : "Not started"}
                  </p>
                </div>

                <span
                  className={[
                    "text-xs font-medium",
                    isCurrent ? "text-indigo-600" : "text-slate-400",
                  ].join(" ")}
                >
                  Go →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <OnboardingActions
        showSkip={!state.skipped && progress.nextStep !== null}
        showWelcomeComplete={!completed.has("welcome") && !state.skipped}
      />
    </div>
  );
}
