import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so detectEmergingTrends can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import { classifyTrend, detectEmergingTrends } from "@/lib/emerging-trends";
import { prisma } from "@/lib/prisma";

describe("classifyTrend", () => {
  it("classifies growth > 50% as rising", () => {
    expect(classifyTrend(51)).toBe("rising");
    expect(classifyTrend(100)).toBe("rising");
  });

  it("treats the 50 boundary as stable (not strictly greater)", () => {
    expect(classifyTrend(50)).toBe("stable");
  });

  it("classifies growth < -25% as declining", () => {
    expect(classifyTrend(-26)).toBe("declining");
    expect(classifyTrend(-100)).toBe("declining");
  });

  it("treats the -25 boundary as stable (not strictly less)", () => {
    expect(classifyTrend(-25)).toBe("stable");
  });

  it("classifies values between -25 and 50 as stable", () => {
    expect(classifyTrend(0)).toBe("stable");
    expect(classifyTrend(49)).toBe("stable");
    expect(classifyTrend(-24)).toBe("stable");
  });

  it("classifies Infinity as rising (new topic)", () => {
    expect(classifyTrend(Infinity)).toBe("rising");
  });
});

describe("detectEmergingTrends", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockReset();
  });

  it("counts topics per window and computes growth rates", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      // current window (last 7 days)
      { topics: ["Bug Report", "Bug Report", "Pricing"], createdAt: days(1) },
      { topics: ["Bug Report"], createdAt: days(2) },
      // previous window (7-14 days ago)
      { topics: ["Bug Report", "Pricing"], createdAt: days(9) },
      { topics: ["Performance"], createdAt: days(10) },
    ] as never[]);

    const trends = await detectEmergingTrends(7);
    const byTopic = new Map(trends.map((t) => [t.topic, t]));

    // Bug Report: current=3, previous=1 -> +200% => rising
    const bug = byTopic.get("Bug Report")!;
    expect(bug.currentCount).toBe(3);
    expect(bug.previousCount).toBe(1);
    expect(bug.growthRate).toBe(200);
    expect(bug.trend).toBe("rising");

    // Pricing: current=1, previous=1 -> 0% => stable
    const pricing = byTopic.get("Pricing")!;
    expect(pricing.growthRate).toBe(0);
    expect(pricing.trend).toBe("stable");

    // Performance: current=0, previous=1 -> -100% => declining
    const perf = byTopic.get("Performance")!;
    expect(perf.currentCount).toBe(0);
    expect(perf.previousCount).toBe(1);
    expect(perf.growthRate).toBe(-100);
    expect(perf.trend).toBe("declining");
  });

  it("handles division by zero (previousCount=0) as Infinity/rising", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["Security", "Security"], createdAt: days(1) },
    ] as never[]);

    const trends = await detectEmergingTrends(7);
    const security = trends.find((t) => t.topic === "Security")!;
    expect(security.previousCount).toBe(0);
    expect(security.currentCount).toBe(2);
    expect(security.growthRate).toBe(Infinity);
    expect(security.trend).toBe("rising");
  });

  it("treats topics absent in both windows as stable with 0 growth", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([] as never[]);

    const trends = await detectEmergingTrends(7);
    // Every taxonomy topic should appear with zero counts and stable trend.
    expect(trends.length).toBeGreaterThan(0);
    for (const t of trends) {
      expect(t.currentCount).toBe(0);
      expect(t.previousCount).toBe(0);
      expect(t.growthRate).toBe(0);
      expect(t.trend).toBe("stable");
    }
  });

  it("classifies a 60% growth as rising and -30% as declining", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    // Onboarding: current=8, previous=5 -> +60% => rising
    // Documentation: current=7, previous=10 -> -30% => declining
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      ...Array.from({ length: 8 }, () => ({
        topics: ["Onboarding"],
        createdAt: days(1),
      })),
      ...Array.from({ length: 5 }, () => ({
        topics: ["Onboarding"],
        createdAt: days(9),
      })),
      ...Array.from({ length: 7 }, () => ({
        topics: ["Documentation"],
        createdAt: days(1),
      })),
      ...Array.from({ length: 10 }, () => ({
        topics: ["Documentation"],
        createdAt: days(9),
      })),
    ] as never[]);

    const trends = await detectEmergingTrends(7);
    const byTopic = new Map(trends.map((t) => [t.topic, t]));

    const onboarding = byTopic.get("Onboarding")!;
    expect(onboarding.growthRate).toBe(60);
    expect(onboarding.trend).toBe("rising");

    const docs = byTopic.get("Documentation")!;
    expect(docs.growthRate).toBe(-30);
    expect(docs.trend).toBe("declining");
  });

  it("sorts trends by growthRate descending with Infinity on top", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    // Onboarding: stable (1 vs 1 -> 0%)
    // Pricing: rising (2 vs 1 -> +100%)
    // Security: brand-new (1 vs 0 -> Infinity)
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["Onboarding"], createdAt: days(1) },
      { topics: ["Onboarding"], createdAt: days(9) },
      { topics: ["Pricing", "Pricing"], createdAt: days(1) },
      { topics: ["Pricing"], createdAt: days(9) },
      { topics: ["Security"], createdAt: days(1) },
    ] as never[]);

    const trends = await detectEmergingTrends(7);
    // Security (Infinity) first, then Pricing (+100%), then Onboarding (0%).
    // Verify relative ordering among these three.
    const securityIdx = trends.findIndex((t) => t.topic === "Security");
    const pricingIdx = trends.findIndex((t) => t.topic === "Pricing");
    const onboardingIdx = trends.findIndex((t) => t.topic === "Onboarding");
    expect(securityIdx).toBeLessThan(pricingIdx);
    expect(pricingIdx).toBeLessThan(onboardingIdx);
    expect(trends[0].topic).toBe("Security");
  });

  it("only counts topics that are part of TOPIC_TAXONOMY", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["Bug Report", "Unknown Topic"], createdAt: days(1) },
    ] as never[]);

    const trends = await detectEmergingTrends(7);
    const topics = trends.map((t) => t.topic);
    expect(topics).not.toContain("Unknown Topic");
    expect(topics).toContain("Bug Report");
  });
});
