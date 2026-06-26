import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Ordered list of onboarding wizard steps. The order here defines the
// progression a new user is guided through.
export const ONBOARDING_STEPS = [
  { id: "welcome", title: "Welcome" },
  { id: "create_source", title: "Create a data source" },
  { id: "run_ingest", title: "Run ingestion" },
  { id: "view_dashboard", title: "View dashboard" },
  { id: "review_inbox", title: "Review inbox" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export interface OnboardingState {
  id: string;
  userId: string;
  completedSteps: string[];
  currentStep: string;
  skipped: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  completionPercentage: number;
  nextStep: string | null;
}

/**
 * Map a raw Prisma row (with a Json `completedSteps` field) into the
 * serializable OnboardingState shape used throughout the app.
 */
function toState(row: {
  id: string;
  userId: string;
  completedSteps: Prisma.JsonValue;
  currentStep: string;
  skipped: boolean;
  createdAt: Date;
  updatedAt: Date;
}): OnboardingState {
  const steps = Array.isArray(row.completedSteps)
    ? (row.completedSteps as unknown[]).filter(
        (s): s is string => typeof s === "string"
      )
    : [];
  return {
    id: row.id,
    userId: row.userId,
    completedSteps: steps,
    currentStep: row.currentStep,
    skipped: row.skipped,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Return the onboarding state for a user. If no record exists yet, create a
 * default one starting at the "welcome" step. Uses upsert to avoid race
 * conditions where a concurrent request creates the record between the
 * findUnique and create calls.
 */
export async function getOnboardingState(
  userId: string
): Promise<OnboardingState> {
  const row = await prisma.onboardingStep.upsert({
    where: { userId },
    create: {
      userId,
      currentStep: "welcome",
      completedSteps: [],
    },
    update: {},
  });
  return toState(row);
}

/**
 * Mark a step as completed. Adds the step id to `completedSteps` (idempotent)
 * and advances `currentStep` to the next unfinished step in ONBOARDING_STEPS.
 */
export async function completeStep(
  userId: string,
  stepId: string
): Promise<OnboardingState> {
  const state = await getOnboardingState(userId);

  const completed = state.completedSteps.includes(stepId)
    ? state.completedSteps
    : [...state.completedSteps, stepId];

  // Advance to the next step that has not been completed yet.
  const orderedIds = ONBOARDING_STEPS.map((s) => s.id);
  const nextStep =
    orderedIds.find((id) => !completed.includes(id)) ?? state.currentStep;

  const updated = await prisma.onboardingStep.update({
    where: { userId },
    data: {
      completedSteps: completed as Prisma.InputJsonValue,
      currentStep: nextStep,
    },
  });
  return toState(updated);
}

/**
 * Mark onboarding as skipped for a user.
 */
export async function skipOnboarding(
  userId: string
): Promise<OnboardingState> {
  // Ensure a record exists before updating.
  await getOnboardingState(userId);

  const updated = await prisma.onboardingStep.update({
    where: { userId },
    data: { skipped: true },
  });
  return toState(updated);
}

/**
 * Compute onboarding progress for a user: current step, completed steps,
 * completion percentage (0-100), and the next unfinished step (or null when
 * all steps are done).
 */
export async function getOnboardingProgress(
  userId: string
): Promise<OnboardingProgress> {
  const state = await getOnboardingState(userId);
  const total = ONBOARDING_STEPS.length as number;
  const completedCount = state.completedSteps.filter((s) =>
    ONBOARDING_STEPS.some((step) => step.id === s)
  ).length;
  const completionPercentage =
    total === 0 ? 0 : Math.round((completedCount / total) * 100);

  const orderedIds = ONBOARDING_STEPS.map((s) => s.id);
  const nextStep =
    orderedIds.find((id) => !state.completedSteps.includes(id)) ?? null;

  return {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    completionPercentage,
    nextStep,
  };
}
