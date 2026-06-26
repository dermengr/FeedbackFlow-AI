import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TimelineInputItem, TimelineDay } from "@/lib/timeline";

// Mock prisma so getTimelineData can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: {
      findMany: vi.fn(),
    },
  },
}));

import { groupByDay, summarizeTimeline, getTimelineData } from "@/lib/timeline";
import { prisma } from "@/lib/prisma";

// Helper: build a Date at a given YYYY-MM-DD (local midnight) so day buckets
// are deterministic regardless of the runtime's timezone offset.
function on(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  // month is 1-based here for readability.
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

const mockedFindMany = vi.mocked(prisma.feedbackItem.findMany);

// The prisma findMany return type is inferred from the (un-mocked) schema and
// does not include the `analysis` relation we select here, so cast through
// unknown when stubbing resolved values.
type FindManyRow = { originalTimestamp: Date; analysis: { sentiment: string } | null };
function mockRows(rows: FindManyRow[]) {
  mockedFindMany.mockResolvedValue(rows as never);
}

beforeEach(() => {
  mockedFindMany.mockReset();
});

describe("groupByDay", () => {
  it("returns an empty array for empty input", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("groups multiple items on the same day into a single bucket", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 1, 15, 9), sentiment: "positive" },
      { date: on(2024, 1, 15, 14), sentiment: "neutral" },
      { date: on(2024, 1, 15, 23), sentiment: "negative" },
    ];
    const days = groupByDay(items);
    expect(days).toHaveLength(1);
    expect(days[0]).toEqual({
      date: "2024-01-15",
      total: 3,
      positive: 1,
      neutral: 1,
      negative: 1,
    });
  });

  it("groups items by sentiment across multiple days and sorts ascending", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 1, 16), sentiment: "negative" },
      { date: on(2024, 1, 16), sentiment: "negative" },
      { date: on(2024, 1, 14), sentiment: "positive" },
      { date: on(2024, 1, 14), sentiment: "positive" },
      { date: on(2024, 1, 14), sentiment: "neutral" },
    ];
    const days = groupByDay(items);
    expect(days.map((d) => d.date)).toEqual(["2024-01-14", "2024-01-16"]);
    expect(days[0]).toEqual({
      date: "2024-01-14",
      total: 3,
      positive: 2,
      neutral: 1,
      negative: 0,
    });
    expect(days[1]).toEqual({
      date: "2024-01-16",
      total: 2,
      positive: 0,
      neutral: 0,
      negative: 2,
    });
  });

  it("counts items without sentiment toward total but not toward sentiment buckets", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 2, 1) },
      { date: on(2024, 2, 1), sentiment: "positive" },
      { date: on(2024, 2, 1), sentiment: "weird" }, // not a canonical sentiment
    ];
    const days = groupByDay(items);
    expect(days).toHaveLength(1);
    expect(days[0]).toEqual({
      date: "2024-02-01",
      total: 3,
      positive: 1,
      neutral: 0,
      negative: 0,
    });
  });

  it("treats midnight and 23:59 on the same calendar day as the same bucket (boundary hours)", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 3, 10, 0), sentiment: "positive" },
      { date: on(2024, 3, 10, 23, 59), sentiment: "negative" },
    ];
    const days = groupByDay(items);
    expect(days).toHaveLength(1);
    expect(days[0].total).toBe(2);
    expect(days[0].positive).toBe(1);
    expect(days[0].negative).toBe(1);
  });

  it("separates adjacent calendar days at the day boundary", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 3, 10, 23, 59), sentiment: "positive" },
      { date: on(2024, 3, 11, 0, 0), sentiment: "negative" },
    ];
    const days = groupByDay(items);
    expect(days.map((d) => d.date)).toEqual(["2024-03-10", "2024-03-11"]);
  });

  it("handles year/month boundary dates", () => {
    const items: TimelineInputItem[] = [
      { date: on(2024, 12, 31, 23, 59), sentiment: "positive" },
      { date: on(2025, 1, 1, 0, 1), sentiment: "neutral" },
    ];
    const days = groupByDay(items);
    expect(days.map((d) => d.date)).toEqual(["2024-12-31", "2025-01-01"]);
  });

  it("skips items with invalid dates", () => {
    const items: TimelineInputItem[] = [
      { date: new Date("not-a-date"), sentiment: "positive" },
      { date: on(2024, 5, 5), sentiment: "neutral" },
    ];
    const days = groupByDay(items);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2024-05-05");
    expect(days[0].total).toBe(1);
  });
});

describe("summarizeTimeline", () => {
  it("returns zeroed summary for no data", () => {
    const summary = summarizeTimeline([], 30);
    expect(summary.totalItems).toBe(0);
    expect(summary.avgPerDay).toBe(0);
    expect(summary.peakDay).toBeNull();
    expect(summary.peakCount).toBe(0);
  });

  it("computes total, average, and peak across day buckets", () => {
    const days: TimelineDay[] = [
      { date: "2024-01-01", total: 4, positive: 2, neutral: 1, negative: 1 },
      { date: "2024-01-02", total: 10, positive: 5, neutral: 3, negative: 2 },
      { date: "2024-01-03", total: 6, positive: 1, neutral: 2, negative: 3 },
    ];
    const summary = summarizeTimeline(days, 30);
    expect(summary.totalItems).toBe(20);
    // 20 / 30 window days
    expect(summary.avgPerDay).toBeCloseTo(20 / 30, 5);
    expect(summary.peakDay).toBe("2024-01-02");
    expect(summary.peakCount).toBe(10);
  });

  it("picks the first day as peak when there is a tie at the max", () => {
    const days: TimelineDay[] = [
      { date: "2024-01-01", total: 5, positive: 0, neutral: 0, negative: 0 },
      { date: "2024-01-02", total: 5, positive: 0, neutral: 0, negative: 0 },
    ];
    const summary = summarizeTimeline(days, 10);
    expect(summary.peakCount).toBe(5);
    expect(summary.peakDay).toBe("2024-01-01");
  });

  it("uses the provided window size for the average denominator", () => {
    const days: TimelineDay[] = [
      { date: "2024-01-01", total: 7, positive: 0, neutral: 0, negative: 0 },
    ];
    const summary = summarizeTimeline(days, 7);
    expect(summary.avgPerDay).toBeCloseTo(1, 5);
  });

  it("guards against a zero window size", () => {
    const days: TimelineDay[] = [
      { date: "2024-01-01", total: 3, positive: 0, neutral: 0, negative: 0 },
    ];
    const summary = summarizeTimeline(days, 0);
    // denominator falls back to 1, so avg = total / 1
    expect(summary.avgPerDay).toBe(3);
  });
});

describe("getTimelineData", () => {
  it("queries feedback items with analysis and returns grouped + summarized data", async () => {
    mockRows([
      { originalTimestamp: on(2024, 6, 1, 10), analysis: { sentiment: "positive" } },
      { originalTimestamp: on(2024, 6, 1, 11), analysis: { sentiment: "negative" } },
      { originalTimestamp: on(2024, 6, 2, 9), analysis: null },
    ]);

    const data = await getTimelineData(30);

    expect(mockedFindMany).toHaveBeenCalledTimes(1);
    const call = mockedFindMany.mock.calls[0][0] as {
      where: { originalTimestamp: { gte: Date }; source?: string };
      select: { originalTimestamp: true; analysis: { select: { sentiment: true } } };
    };
    // cutoff is within the last 30 days
    expect(call.where.originalTimestamp.gte).toBeInstanceOf(Date);
    expect(call.where.source).toBeUndefined();
    expect(call.select.analysis).toEqual({ select: { sentiment: true } });

    expect(data.days).toHaveLength(2);
    expect(data.days[0]).toEqual({
      date: "2024-06-01",
      total: 2,
      positive: 1,
      neutral: 0,
      negative: 1,
    });
    expect(data.days[1]).toEqual({
      date: "2024-06-02",
      total: 1,
      positive: 0,
      neutral: 0,
      negative: 0,
    });
    expect(data.summary.totalItems).toBe(3);
    expect(data.summary.peakDay).toBe("2024-06-01");
    expect(data.summary.peakCount).toBe(2);
  });

  it("passes the source filter through to the prisma query when provided", async () => {
    mockRows([]);

    await getTimelineData(14, "GitHubIssues");

    expect(mockedFindMany).toHaveBeenCalledTimes(1);
    const call = mockedFindMany.mock.calls[0][0] as {
      where: { originalTimestamp: { gte: Date }; source?: string };
    };
    expect(call.where.source).toBe("GitHubIssues");
  });

  it("returns an empty timeline when there is no feedback", async () => {
    mockRows([]);
    const data = await getTimelineData(30);
    expect(data.days).toEqual([]);
    expect(data.summary).toEqual({
      totalItems: 0,
      avgPerDay: 0,
      peakDay: null,
      peakCount: 0,
    });
  });
});
