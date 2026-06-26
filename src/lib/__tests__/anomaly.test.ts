import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so detectAnomalies can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: {
      findMany: vi.fn(),
    },
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import {
  calculateRollingStats,
  detectSpike,
  detectAnomalies,
} from "@/lib/anomaly";
import { prisma } from "@/lib/prisma";

describe("calculateRollingStats", () => {
  it("returns zero stats and empty zscores for an empty array", () => {
    const stats = calculateRollingStats([], 7);
    expect(stats.avg).toBe(0);
    expect(stats.stddev).toBe(0);
    expect(stats.zscores).toEqual([]);
  });

  it("computes avg and stddev over the full array when window exceeds length", () => {
    // values 2,4,6 -> mean 4, population variance ((-2)^2+0+2^2)/3 = 8/3
    const stats = calculateRollingStats([2, 4, 6], 7);
    expect(stats.avg).toBeCloseTo(4, 5);
    expect(stats.stddev).toBeCloseTo(Math.sqrt(8 / 3), 5);
    expect(stats.zscores).toHaveLength(3);
  });

  it("produces one z-score per element", () => {
    const stats = calculateRollingStats([1, 2, 3, 4, 5, 6, 7, 8], 7);
    expect(stats.zscores).toHaveLength(8);
    for (const z of stats.zscores) {
      expect(typeof z).toBe("number");
      expect(Number.isFinite(z)).toBe(true);
    }
  });

  it("uses only the trailing window for the final avg/stddev", () => {
    // Last 3 values within a window of 3 are [6,7,8] -> mean 7.
    const stats = calculateRollingStats([1, 2, 3, 4, 5, 6, 7, 8], 3);
    expect(stats.avg).toBeCloseTo(7, 5);
    // population stddev of [6,7,8] = sqrt(2/3)
    expect(stats.stddev).toBeCloseTo(Math.sqrt(2 / 3), 5);
  });

  it("yields a z-score of 0 when the window has no dispersion", () => {
    const stats = calculateRollingStats([5, 5, 5, 5], 7);
    expect(stats.stddev).toBe(0);
    expect(stats.zscores).toEqual([0, 0, 0, 0]);
  });

  it("handles windowSize of 1 (each value is its own window)", () => {
    const stats = calculateRollingStats([3, 9, -2], 1);
    expect(stats.avg).toBe(-2);
    expect(stats.stddev).toBe(0);
    expect(stats.zscores).toEqual([0, 0, 0]);
  });
});

describe("detectSpike", () => {
  it("returns true when value exceeds avg + threshold * stddev", () => {
    expect(detectSpike(20, 10, 2, 2)).toBe(true); // 20 > 14
  });

  it("returns false when value is below the threshold", () => {
    expect(detectSpike(13, 10, 2, 2)).toBe(false); // 13 < 14
  });

  it("returns false when value is exactly at the threshold", () => {
    expect(detectSpike(14, 10, 2, 2)).toBe(false); // 14 === 14, not strictly greater
  });

  it("uses a default threshold of 2", () => {
    // avg 0, stddev 1 -> threshold line at 2. 3 > 2 -> spike.
    expect(detectSpike(3, 0, 1)).toBe(true);
    expect(detectSpike(2, 0, 1)).toBe(false);
  });

  it("collapses to value > avg when stddev is 0", () => {
    expect(detectSpike(6, 5, 0)).toBe(true);
    expect(detectSpike(5, 5, 0)).toBe(false);
    expect(detectSpike(4, 5, 0)).toBe(false);
  });
});

describe("detectAnomalies", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackItem.findMany).mockReset();
    vi.mocked(prisma.feedbackAnalysis.findMany).mockReset();
  });

  it("returns the expected top-level data structure", async () => {
    vi.mocked(prisma.feedbackItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([]);

    const result = await detectAnomalies(30);
    expect(result).toHaveProperty("volumeAnomalies");
    expect(result).toHaveProperty("sentimentAnomalies");
    expect(result).toHaveProperty("summary");
    expect(Array.isArray(result.volumeAnomalies)).toBe(true);
    expect(Array.isArray(result.sentimentAnomalies)).toBe(true);
    expect(result.summary).toHaveProperty("totalAnomalies");
    expect(result.summary).toHaveProperty("lastAnomalyDate");
  });

  it("reports no anomalies and a null lastAnomalyDate on empty data", async () => {
    vi.mocked(prisma.feedbackItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([]);

    const result = await detectAnomalies(30);
    expect(result.volumeAnomalies).toEqual([]);
    expect(result.sentimentAnomalies).toEqual([]);
    expect(result.summary.totalAnomalies).toBe(0);
    expect(result.summary.lastAnomalyDate).toBeNull();
  });

  it("flags a volume spike that exceeds the prior 7-day baseline", async () => {
    // days=4 -> totalDays=8. Build a flat baseline of 1 item/day for days
    // 0..6, then a large spike on day 7.
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const start = now - 8 * DAY;
    const items: { originalTimestamp: Date }[] = [];
    for (let d = 0; d < 7; d++) {
      items.push({ originalTimestamp: new Date(start + d * DAY) });
    }
    // Spike well above avg(1) + 2*stddev(0) = 1.
    for (let k = 0; k < 50; k++) {
      items.push({ originalTimestamp: new Date(start + 7 * DAY) });
    }

    vi.mocked(prisma.feedbackItem.findMany).mockResolvedValue(items as never[]);
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([]);

    const result = await detectAnomalies(4);
    expect(result.volumeAnomalies.length).toBeGreaterThanOrEqual(1);
    const anomaly = result.volumeAnomalies.find(
      (v) => v.count === 50
    );
    expect(anomaly).toBeDefined();
    expect(anomaly!.expected).toBe(1);
    expect(anomaly!.deviation).toBe(49);
    expect(result.summary.totalAnomalies).toBeGreaterThanOrEqual(1);
    expect(result.summary.lastAnomalyDate).toBe(anomaly!.date);
  });

  it("flags a negative-sentiment-rate spike", async () => {
    // days=4 -> totalDays=8. Days 0..6: 10 analyses each, 0 negative (rate 0).
    // Day 7: 10 analyses, all negative (rate 1). Baseline rate 0, stddev 0 ->
    // threshold line at 0; rate 1 > 0 -> spike.
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const start = now - 8 * DAY;
    const analyses: { createdAt: Date; sentiment: string }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let k = 0; k < 10; k++) {
        analyses.push({
          createdAt: new Date(start + d * DAY),
          sentiment: "positive",
        });
      }
    }
    for (let k = 0; k < 10; k++) {
      analyses.push({
        createdAt: new Date(start + 7 * DAY),
        sentiment: "negative",
      });
    }

    vi.mocked(prisma.feedbackItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue(
      analyses as never[]
    );

    const result = await detectAnomalies(4);
    expect(result.sentimentAnomalies.length).toBeGreaterThanOrEqual(1);
    const anomaly = result.sentimentAnomalies.find((s) => s.negativeRate === 1);
    expect(anomaly).toBeDefined();
    expect(anomaly!.expectedRate).toBe(0);
    expect(anomaly!.deviation).toBe(1);
  });

  it("does not flag sentiment anomalies on days with no analyses", async () => {
    // No analyses at all -> no sentiment anomalies, even though negRates are 0.
    vi.mocked(prisma.feedbackItem.findMany).mockResolvedValue([]);
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([]);

    const result = await detectAnomalies(10);
    expect(result.sentimentAnomalies).toEqual([]);
  });
});
