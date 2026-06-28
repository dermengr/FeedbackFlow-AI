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
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

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
    <PageShell className="space-y-6">
      <PageHeader
        title="Onboarding Wizard"
        description="Complete these steps to get FeedbackFlow up and running."
      />

      <PageSection>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {progress.completionPercentage}% complete
            </span>
            {state.skipped ? (
              <span className="text-slate-400">Onboarding skipped</span>
            ) : progress.nextStep === null ? (
              <span className="text-indigo-600 dark:text-indigo-400">All steps complete</span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                Next: {ONBOARDING_STEPS.find((s) => s.id === progress.nextStep)?.title}
              </span>
            )}
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-brand-500 transition-all duration-700 ease-out"
              style={{ width: `${progress.completionPercentage}%` }}
            />
          </div>
        </div>
      </PageSection>

      <ol className="space-y-3">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completed.has(step.id);
          const isCurrent = state.currentStep === step.id && !isCompleted;
          const href = STEP_LINKS[step.id] ?? "/onboarding";

          return (
            <PageSection key={step.id}>
              <Link
                href={href}
                className={[
                  "group flex items-center gap-4 rounded-xl border p-4 transition-all duration-200",
                  isCurrent
                    ? "border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-200 shadow-soft dark:bg-indigo-900/20 dark:border-indigo-500/50 dark:ring-indigo-500/30"
                    : isCompleted
                    ? "card-modern border-emerald-200/60 bg-emerald-50/30 hover:bg-emerald-50/50 dark:bg-emerald-900/10 dark:border-emerald-500/30"
                    : "card-modern",
                ].join(" ")}
              >
                <div
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-transform duration-200 group-hover:scale-110",
                    isCompleted
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm"
                      : isCurrent
                      ? "bg-gradient-to-br from-indigo-500 to-brand-500 text-white shadow-sm"
                      : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400",
                  ].join(" ")}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={[
                      "text-sm font-semibold",
                      isCurrent ? "text-indigo-900 dark:text-indigo-100" : "text-slate-900 dark:text-slate-100",
                    ].join(" ")}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isCompleted
                      ? "Completed"
                      : isCurrent
                      ? "In progress"
                      : "Not started"}
                  </p>
                </div>

                <span
                  className={[
                    "text-xs font-semibold transition-colors",
                    isCurrent ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300",
                  ].join(" ")}
                >
                  Go →
                </span>
              </Link>
            </PageSection>
          );
        })}
      </ol>

      <PageSection>
        <OnboardingActions
          showSkip={!state.skipped && progress.nextStep !== null}
          showWelcomeComplete={!completed.has("welcome") && !state.skipped}
        />
      </PageSection>
    </PageShell>
  );
}
