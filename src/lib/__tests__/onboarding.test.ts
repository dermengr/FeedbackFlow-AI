import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    onboardingStep: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  ONBOARDING_STEPS,
  getOnboardingState,
  completeStep,
  skipOnboarding,
  getOnboardingProgress,
} from "@/lib/onboarding";

const mockUpsert = prisma.onboardingStep.upsert as unknown as ReturnType<
  typeof vi.fn
>;
const mockUpdate = prisma.onboardingStep.update as unknown as ReturnType<
  typeof vi.fn
>;

const userId = "user_1";

function row(overrides: Partial<{
  id: string;
  userId: string;
  completedSteps: unknown;
  currentStep: string;
  skipped: boolean;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: "ob_1",
    userId,
    completedSteps: [] as unknown[],
    currentStep: "welcome",
    skipped: false,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ONBOARDING_STEPS", () => {
  it("exports the expected ordered steps", () => {
    expect(ONBOARDING_STEPS.map((s) => s.id)).toEqual([
      "welcome",
      "create_source",
      "run_ingest",
      "view_dashboard",
      "review_inbox",
    ]);
  });
});

describe("getOnboardingState", () => {
  it("returns the existing state when a record exists", async () => {
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: ["welcome"], currentStep: "create_source" })
    );

    const state = await getOnboardingState(userId);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId },
      create: { userId, currentStep: "welcome", completedSteps: [] },
      update: {},
    });
    expect(state.completedSteps).toEqual(["welcome"]);
    expect(state.currentStep).toBe("create_source");
  });

  it("creates a default state with currentStep=welcome when none exists", async () => {
    mockUpsert.mockResolvedValueOnce(row());

    const state = await getOnboardingState(userId);

    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId },
      create: {
        userId,
        currentStep: "welcome",
        completedSteps: [],
      },
      update: {},
    });
    expect(state.currentStep).toBe("welcome");
    expect(state.completedSteps).toEqual([]);
    expect(state.skipped).toBe(false);
  });

  it("coerces non-array completedSteps into an empty array", async () => {
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: "not-an-array" })
    );

    const state = await getOnboardingState(userId);
    expect(state.completedSteps).toEqual([]);
  });
});

describe("completeStep", () => {
  it("adds the step to completedSteps and advances currentStep to the next unfinished step", async () => {
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: ["welcome"], currentStep: "create_source" })
    );
    mockUpdate.mockResolvedValueOnce(
      row({
        completedSteps: ["welcome", "create_source"],
        currentStep: "run_ingest",
      })
    );

    const state = await completeStep(userId, "create_source");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId },
      data: {
        completedSteps: ["welcome", "create_source"],
        currentStep: "run_ingest",
      },
    });
    expect(state.completedSteps).toEqual(["welcome", "create_source"]);
    expect(state.currentStep).toBe("run_ingest");
  });

  it("does not duplicate a step that is already completed", async () => {
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: ["welcome", "create_source"], currentStep: "run_ingest" })
    );
    mockUpdate.mockResolvedValueOnce(
      row({
        completedSteps: ["welcome", "create_source"],
        currentStep: "run_ingest",
      })
    );

    await completeStep(userId, "create_source");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId },
      data: {
        completedSteps: ["welcome", "create_source"],
        currentStep: "run_ingest",
      },
    });
  });

  it("keeps currentStep when all steps are completed", async () => {
    const all = ONBOARDING_STEPS.map((s) => s.id);
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: all, currentStep: "review_inbox" })
    );
    mockUpdate.mockResolvedValueOnce(
      row({ completedSteps: all, currentStep: "review_inbox" })
    );

    await completeStep(userId, "review_inbox");

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId },
      data: {
        completedSteps: all,
        currentStep: "review_inbox",
      },
    });
  });
});

describe("skipOnboarding", () => {
  it("ensures a record exists and marks it as skipped", async () => {
    mockUpsert.mockResolvedValueOnce(row());
    mockUpdate.mockResolvedValueOnce(row({ skipped: true }));

    const state = await skipOnboarding(userId);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId },
      data: { skipped: true },
    });
    expect(state.skipped).toBe(true);
  });

  it("creates a default record first when none exists, then skips", async () => {
    mockUpsert.mockResolvedValueOnce(row());
    mockUpdate.mockResolvedValueOnce(row({ skipped: true }));

    const state = await skipOnboarding(userId);

    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { userId },
      data: { skipped: true },
    });
    expect(state.skipped).toBe(true);
  });
});

describe("getOnboardingProgress", () => {
  it("computes 0% and nextStep=welcome when nothing is completed", async () => {
    mockUpsert.mockResolvedValueOnce(row());

    const progress = await getOnboardingProgress(userId);

    expect(progress.completionPercentage).toBe(0);
    expect(progress.nextStep).toBe("welcome");
    expect(progress.completedSteps).toEqual([]);
  });

  it("computes the percentage based on completed steps", async () => {
    // 2 of 5 steps completed => 40%
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: ["welcome", "create_source"] })
    );

    const progress = await getOnboardingProgress(userId);

    expect(progress.completionPercentage).toBe(40);
    expect(progress.nextStep).toBe("run_ingest");
  });

  it("returns 100% and nextStep=null when all steps are completed", async () => {
    const all = ONBOARDING_STEPS.map((s) => s.id);
    mockUpsert.mockResolvedValueOnce(row({ completedSteps: all }));

    const progress = await getOnboardingProgress(userId);

    expect(progress.completionPercentage).toBe(100);
    expect(progress.nextStep).toBeNull();
  });

  it("ignores completed step ids that are not part of ONBOARDING_STEPS", async () => {
    mockUpsert.mockResolvedValueOnce(
      row({ completedSteps: ["welcome", "bogus_step"] })
    );

    const progress = await getOnboardingProgress(userId);

    // Only "welcome" counts => 1 of 5 => 20%
    expect(progress.completionPercentage).toBe(20);
  });
});
