import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so getHeatmapData can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import { groupHeatmap, emptyHeatmapGrid, getHeatmapData } from "@/lib/heatmap";
import type { HeatmapInputRow } from "@/lib/heatmap";
import { prisma } from "@/lib/prisma";

// Helper: build a Date for a given day-of-week (0-6) and hour (0-23).
// Uses a known reference week so getDay/getHours are deterministic.
// 2023-01-01 was a Sunday (day 0) at 00:00 UTC.
const base = new Date(Date.UTC(2023, 0, 1, 0, 0, 0));
function at(day: number, hour: number): Date {
  // Add `day` days and `hour` hours to the Sunday 00:00 base.
  return new Date(base.getTime() + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
}

function cell(grid: ReturnType<typeof groupHeatmap>, day: number, hour: number) {
  return grid[day * 24 + hour];
}

describe("emptyHeatmapGrid", () => {
  it("produces a 7x24 = 168 cell grid with zeroed counts", () => {
    const grid = emptyHeatmapGrid();
    expect(grid).toHaveLength(168);
    for (const c of grid) {
      expect(c.positive).toBe(0);
      expect(c.neutral).toBe(0);
      expect(c.negative).toBe(0);
      expect(c.total).toBe(0);
    }
  });

  it("orders cells by day then hour with correct day/hour labels", () => {
    const grid = emptyHeatmapGrid();
    expect(grid[0]).toEqual({ day: 0, hour: 0, positive: 0, neutral: 0, negative: 0, total: 0 });
    expect(grid[23]).toEqual({ day: 0, hour: 23, positive: 0, neutral: 0, negative: 0, total: 0 });
    expect(grid[24]).toEqual({ day: 1, hour: 0, positive: 0, neutral: 0, negative: 0, total: 0 });
    expect(grid[167]).toEqual({ day: 6, hour: 23, positive: 0, neutral: 0, negative: 0, total: 0 });
  });
});

describe("groupHeatmap", () => {
  it("returns an empty 168-cell grid for empty input", () => {
    const grid = groupHeatmap([]);
    expect(grid).toHaveLength(168);
    for (const c of grid) {
      expect(c.total).toBe(0);
    }
  });

  it("counts a single positive row into the correct cell", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: at(2, 9) }, // Tuesday 09:00
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 2, 9)).toEqual({
      day: 2,
      hour: 9,
      positive: 1,
      neutral: 0,
      negative: 0,
      total: 1,
    });
    // All other cells remain empty.
    expect(cell(grid, 2, 10).total).toBe(0);
    expect(cell(grid, 3, 9).total).toBe(0);
  });

  it("accumulates multiple sentiments into the same cell", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: at(1, 8) },
      { sentiment: "positive", originalTimestamp: at(1, 8) },
      { sentiment: "neutral", originalTimestamp: at(1, 8) },
      { sentiment: "negative", originalTimestamp: at(1, 8) },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 1, 8)).toEqual({
      day: 1,
      hour: 8,
      positive: 2,
      neutral: 1,
      negative: 1,
      total: 4,
    });
  });

  it("distributes rows across distinct cells", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "negative", originalTimestamp: at(0, 0) }, // Sun 00:00
      { sentiment: "negative", originalTimestamp: at(6, 23) }, // Sat 23:00
      { sentiment: "positive", originalTimestamp: at(3, 12) }, // Wed 12:00
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 0, 0).negative).toBe(1);
    expect(cell(grid, 0, 0).total).toBe(1);
    expect(cell(grid, 6, 23).negative).toBe(1);
    expect(cell(grid, 6, 23).total).toBe(1);
    expect(cell(grid, 3, 12).positive).toBe(1);
    expect(cell(grid, 3, 12).total).toBe(1);
  });

  it("handles all-same-sentiment input (all negative)", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "negative", originalTimestamp: at(4, 17) },
      { sentiment: "negative", originalTimestamp: at(4, 17) },
      { sentiment: "negative", originalTimestamp: at(5, 1) },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 4, 17)).toEqual({
      day: 4,
      hour: 17,
      positive: 0,
      neutral: 0,
      negative: 2,
      total: 2,
    });
    expect(cell(grid, 5, 1).negative).toBe(1);
  });

  it("ignores rows with unknown sentiment values", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: at(0, 0) },
      { sentiment: "angry", originalTimestamp: at(0, 0) }, // not a sentiment
      { sentiment: "", originalTimestamp: at(0, 0) },
      { sentiment: "POSITIVE", originalTimestamp: at(0, 0) }, // case-sensitive
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 0, 0)).toEqual({
      day: 0,
      hour: 0,
      positive: 1,
      neutral: 0,
      negative: 0,
      total: 1,
    });
  });

  it("skips rows with invalid dates", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: new Date("not-a-date") },
      { sentiment: "negative", originalTimestamp: at(2, 14) },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 2, 14).total).toBe(1);
    // No cell should have more than 1 total (the invalid row was dropped).
    const totalSum = grid.reduce((acc, c) => acc + c.total, 0);
    expect(totalSum).toBe(1);
  });

  it("handles boundary hours 0 and 23", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "neutral", originalTimestamp: at(1, 0) },
      { sentiment: "neutral", originalTimestamp: at(1, 23) },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 1, 0).neutral).toBe(1);
    expect(cell(grid, 1, 23).neutral).toBe(1);
  });

  it("handles boundary days 0 (Sunday) and 6 (Saturday)", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: at(0, 6) },
      { sentiment: "positive", originalTimestamp: at(6, 18) },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 0, 6).positive).toBe(1);
    expect(cell(grid, 6, 18).positive).toBe(1);
  });

  it("accepts ISO date strings in addition to Date objects", () => {
    const rows: HeatmapInputRow[] = [
      { sentiment: "positive", originalTimestamp: at(2, 10).toISOString() as unknown as Date },
    ];
    const grid = groupHeatmap(rows);
    expect(cell(grid, 2, 10).total).toBe(1);
  });
});

describe("getHeatmapData", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockReset();
  });

  it("queries with a cutoff and returns grouped grid", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { sentiment: "positive", feedbackItem: { originalTimestamp: at(1, 9) } },
      { sentiment: "negative", feedbackItem: { originalTimestamp: at(5, 20) } },
    ] as never[]);

    const grid = await getHeatmapData(7);
    expect(grid).toHaveLength(168);
    expect(cell(grid, 1, 9).positive).toBe(1);
    expect(cell(grid, 5, 20).negative).toBe(1);

    // Verify the cutoff was passed: the where clause should contain a gte Date.
    const call = vi.mocked(prisma.feedbackAnalysis.findMany).mock.calls[0][0] as {
      where: { feedbackItem: { originalTimestamp: { gte: Date } } };
    };
    expect(call.where.feedbackItem.originalTimestamp.gte).toBeInstanceOf(Date);
  });

  it("defaults to a 30-day window when no argument is given", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([] as never[]);

    await getHeatmapData();
    const call = vi.mocked(prisma.feedbackAnalysis.findMany).mock.calls[0][0] as {
      where: { feedbackItem: { originalTimestamp: { gte: Date } } };
    };
    const cutoff = call.where.feedbackItem.originalTimestamp.gte.getTime();
    // ~30 days ago (allow a few seconds of slack for test execution).
    const expected = Date.now() - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs(cutoff - expected)).toBeLessThan(5000);
  });

  it("returns an empty grid when the DB returns no analyses", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([] as never[]);
    const grid = await getHeatmapData(30);
    expect(grid).toHaveLength(168);
    for (const c of grid) {
      expect(c.total).toBe(0);
    }
  });
});
