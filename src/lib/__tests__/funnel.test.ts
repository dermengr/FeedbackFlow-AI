import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FunnelStage } from "@/lib/funnel";

// Mock prisma so getFunnelData can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      groupBy: vi.fn(),
    },
  },
}));

import { calculateConversionRates, getFunnelData } from "@/lib/funnel";
import { prisma } from "@/lib/prisma";

const stage = (
  name: FunnelStage["name"],
  count: number,
  percentage = 0
): FunnelStage => ({ name, count, percentage });

describe("calculateConversionRates", () => {
  it("computes rates for a healthy funnel", () => {
    // NEW=100, ACKNOWLEDGED=50, ACTIONED=25
    const stages: FunnelStage[] = [
      stage("NEW", 100),
      stage("ACKNOWLEDGED", 50),
      stage("ACTIONED", 25),
    ];
    const rates = calculateConversionRates(stages);
    // newToAcknowledged = (50 + 25) / 100 = 75%
    expect(rates.newToAcknowledged).toBe(75);
    // acknowledgedToActioned = 25 / (50 + 25) = 33.33%
    expect(rates.acknowledgedToActioned).toBeCloseTo(33.333, 1);
    // overall = 25 / 100 = 25%
    expect(rates.overall).toBe(25);
  });

  it("returns 0 for all rates when every count is zero", () => {
    const stages: FunnelStage[] = [
      stage("NEW", 0),
      stage("ACKNOWLEDGED", 0),
      stage("ACTIONED", 0),
    ];
    const rates = calculateConversionRates(stages);
    expect(rates.newToAcknowledged).toBe(0);
    expect(rates.acknowledgedToActioned).toBe(0);
    expect(rates.overall).toBe(0);
  });

  it("handles all items in a single stage (NEW only)", () => {
    const stages: FunnelStage[] = [
      stage("NEW", 80),
      stage("ACKNOWLEDGED", 0),
      stage("ACTIONED", 0),
    ];
    const rates = calculateConversionRates(stages);
    expect(rates.newToAcknowledged).toBe(0);
    expect(rates.acknowledgedToActioned).toBe(0);
    expect(rates.overall).toBe(0);
  });

  it("handles all items in ACKNOWLEDGED only (no NEW)", () => {
    const stages: FunnelStage[] = [
      stage("NEW", 0),
      stage("ACKNOWLEDGED", 40),
      stage("ACTIONED", 0),
    ];
    const rates = calculateConversionRates(stages);
    // newCount=0 -> newToAcknowledged and overall are 0
    expect(rates.newToAcknowledged).toBe(0);
    // acknowledgedPlusActioned=40, actioned=0 -> 0%
    expect(rates.acknowledgedToActioned).toBe(0);
    expect(rates.overall).toBe(0);
  });

  it("handles all items fully converted to ACTIONED", () => {
    const stages: FunnelStage[] = [
      stage("NEW", 0),
      stage("ACKNOWLEDGED", 0),
      stage("ACTIONED", 60),
    ];
    const rates = calculateConversionRates(stages);
    // newCount=0 -> newToAcknowledged and overall are 0
    expect(rates.newToAcknowledged).toBe(0);
    // acknowledgedPlusActioned=60, actioned=60 -> 100%
    expect(rates.acknowledgedToActioned).toBe(100);
    expect(rates.overall).toBe(0);
  });

  it("handles empty stage list", () => {
    const rates = calculateConversionRates([]);
    expect(rates.newToAcknowledged).toBe(0);
    expect(rates.acknowledgedToActioned).toBe(0);
    expect(rates.overall).toBe(0);
  });

  it("computes 100% conversion when NEW equals ACKNOWLEDGED+ACTIONED and all actioned", () => {
    const stages: FunnelStage[] = [
      stage("NEW", 100),
      stage("ACKNOWLEDGED", 0),
      stage("ACTIONED", 100),
    ];
    const rates = calculateConversionRates(stages);
    expect(rates.newToAcknowledged).toBe(100);
    expect(rates.acknowledgedToActioned).toBe(100);
    expect(rates.overall).toBe(100);
  });

  it("is resilient to stages provided out of order", () => {
    const stages: FunnelStage[] = [
      stage("ACTIONED", 25),
      stage("NEW", 100),
      stage("ACKNOWLEDGED", 50),
    ];
    const rates = calculateConversionRates(stages);
    expect(rates.newToAcknowledged).toBe(75);
    expect(rates.acknowledgedToActioned).toBeCloseTo(33.333, 1);
    expect(rates.overall).toBe(25);
  });
});

describe("getFunnelData", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackAnalysis.groupBy).mockReset();
  });

  it("builds stages and conversion rates from grouped counts", async () => {
    vi.mocked(prisma.feedbackAnalysis.groupBy).mockResolvedValue([
      { status: "NEW", _count: { _all: 100 } },
      { status: "ACKNOWLEDGED", _count: { _all: 50 } },
      { status: "ACTIONED", _count: { _all: 25 } },
    ] as never[]);

    const data = await getFunnelData(30);

    expect(data.stages).toHaveLength(3);
    expect(data.stages.map((s) => s.name)).toEqual([
      "NEW",
      "ACKNOWLEDGED",
      "ACTIONED",
    ]);
    expect(data.stages[0].count).toBe(100);
    expect(data.stages[0].percentage).toBe(100); // NEW is the top of funnel
    expect(data.stages[1].count).toBe(50);
    expect(data.stages[1].percentage).toBe(50); // 50/100
    expect(data.stages[2].count).toBe(25);
    expect(data.stages[2].percentage).toBe(25); // 25/100

    expect(data.conversionRates.newToAcknowledged).toBe(75);
    expect(data.conversionRates.acknowledgedToActioned).toBeCloseTo(33.333, 1);
    expect(data.conversionRates.overall).toBe(25);
  });

  it("defaults missing statuses to zero counts", async () => {
    vi.mocked(prisma.feedbackAnalysis.groupBy).mockResolvedValue([
      { status: "NEW", _count: { _all: 40 } },
    ] as never[]);

    const data = await getFunnelData(7);

    expect(data.stages[0].count).toBe(40);
    expect(data.stages[0].percentage).toBe(100);
    expect(data.stages[1].count).toBe(0);
    expect(data.stages[1].percentage).toBe(0);
    expect(data.stages[2].count).toBe(0);
    expect(data.stages[2].percentage).toBe(0);

    expect(data.conversionRates.newToAcknowledged).toBe(0);
    expect(data.conversionRates.acknowledgedToActioned).toBe(0);
    expect(data.conversionRates.overall).toBe(0);
  });

  it("handles empty data (no records in range)", async () => {
    vi.mocked(prisma.feedbackAnalysis.groupBy).mockResolvedValue(
      [] as never[]
    );

    const data = await getFunnelData(30);

    expect(data.stages).toHaveLength(3);
    for (const s of data.stages) {
      expect(s.count).toBe(0);
      expect(s.percentage).toBe(0);
    }
    expect(data.conversionRates.newToAcknowledged).toBe(0);
    expect(data.conversionRates.acknowledgedToActioned).toBe(0);
    expect(data.conversionRates.overall).toBe(0);
  });

  it("passes the time range filter to prisma", async () => {
    vi.mocked(prisma.feedbackAnalysis.groupBy).mockResolvedValue(
      [] as never[]
    );

    await getFunnelData(14);

    expect(prisma.feedbackAnalysis.groupBy).toHaveBeenCalledTimes(1);
    const args = vi.mocked(prisma.feedbackAnalysis.groupBy).mock.calls[0][0];
    const where = args?.where as { createdAt?: { gte?: Date } };
    expect(where).toBeDefined();
    expect(where.createdAt).toBeDefined();
    expect(where.createdAt?.gte).toBeInstanceOf(Date);
  });
});
