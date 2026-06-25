import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so computeTopicTrends can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import { computeTrendDirection, computeTopicTrends } from "@/lib/trends";
import { prisma } from "@/lib/prisma";

describe("computeTrendDirection", () => {
  it("classifies 50% change as rising", () => {
    expect(computeTrendDirection(50)).toBe("rising");
  });

  it("classifies -50% change as falling", () => {
    expect(computeTrendDirection(-50)).toBe("falling");
  });

  it("classifies 10% change as stable", () => {
    expect(computeTrendDirection(10)).toBe("stable");
  });

  it("classifies Infinity as rising", () => {
    expect(computeTrendDirection(Infinity)).toBe("rising");
  });

  it("treats the 20 threshold boundary as stable (not strictly greater)", () => {
    expect(computeTrendDirection(20)).toBe("stable");
  });

  it("treats the -20 threshold boundary as stable (not strictly less)", () => {
    expect(computeTrendDirection(-20)).toBe("stable");
  });

  it("classifies 21% as rising and -21% as falling", () => {
    expect(computeTrendDirection(21)).toBe("rising");
    expect(computeTrendDirection(-21)).toBe("falling");
  });
});

describe("computeTopicTrends", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockReset();
  });

  it("counts topics per week and computes percentage changes", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      // this week
      { topics: ["bug", "bug", "ui"], createdAt: days(1) },
      { topics: ["bug"], createdAt: days(2) },
      // last week
      { topics: ["bug", "ui"], createdAt: days(9) },
      { topics: ["performance"], createdAt: days(10) },
    ] as never[]);

    const trends = await computeTopicTrends();
    const byTopic = new Map(trends.map((t) => [t.topic, t]));

    // bug: thisWeek=3, lastWeek=1 -> +200%
    const bug = byTopic.get("bug")!;
    expect(bug.thisWeek).toBe(3);
    expect(bug.lastWeek).toBe(1);
    expect(bug.changePct).toBe(200);
    expect(bug.direction).toBe("rising");

    // ui: thisWeek=1, lastWeek=1 -> 0%
    const ui = byTopic.get("ui")!;
    expect(ui.changePct).toBe(0);
    expect(ui.direction).toBe("stable");

    // performance: thisWeek=0, lastWeek=1 -> -100%
    const perf = byTopic.get("performance")!;
    expect(perf.changePct).toBe(-100);
    expect(perf.direction).toBe("falling");
  });

  it("marks new topics (lastWeek=0) as Infinity / rising", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["newtopic", "newtopic"], createdAt: days(1) },
    ] as never[]);

    const trends = await computeTopicTrends();
    const t = trends.find((x) => x.topic === "newtopic")!;
    expect(t.lastWeek).toBe(0);
    expect(t.changePct).toBe(Infinity);
    expect(t.direction).toBe("rising");
  });

  it("sorts trends by changePct descending with Infinity on top", async () => {
    const now = Date.now();
    const days = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["stable"], createdAt: days(1) },
      { topics: ["stable"], createdAt: days(9) },
      { topics: ["rising", "rising"], createdAt: days(1) },
      { topics: ["rising"], createdAt: days(9) },
      { topics: ["brandnew"], createdAt: days(1) },
    ] as never[]);

    const trends = await computeTopicTrends();
    // brandnew (Infinity) first, then rising (+100%), then stable (0%)
    expect(trends[0].topic).toBe("brandnew");
    expect(trends[1].topic).toBe("rising");
    expect(trends[2].topic).toBe("stable");
  });
});
