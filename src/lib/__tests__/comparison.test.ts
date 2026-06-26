import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  ComparisonAnalysisRow,
  PeriodStats,
} from "@/lib/comparison";

// Mock prisma so comparePeriods / compareSources can be exercised without a DB.
const { mockFeedbackFindMany } = vi.hoisted(() => ({
  mockFeedbackFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: { findMany: mockFeedbackFindMany },
  },
}));

import {
  aggregatePeriodStats,
  calculateDeltas,
  comparePeriods,
  compareSources,
} from "@/lib/comparison";
import { prisma } from "@/lib/prisma";

// Helper: build a row with sensible defaults.
const row = (over: Partial<ComparisonAnalysisRow> = {}): ComparisonAnalysisRow => ({
  sentiment: "positive",
  status: "NEW",
  severityScore: 3,
  topics: [],
  ...over,
});

const emptyStats: PeriodStats = {
  totalItems: 0,
  sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
  avgSeverity: 0,
  topTopics: [],
  statusDistribution: {},
};

// ---------------------------------------------------------------------------
// aggregatePeriodStats
// ---------------------------------------------------------------------------

describe("aggregatePeriodStats", () => {
  it("computes total items, sentiment percentages, avg severity and status counts", () => {
    const rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "positive", status: "NEW", severityScore: 2, topics: ["Bug Report", "Performance"] }),
      row({ sentiment: "positive", status: "NEW", severityScore: 4, topics: ["Bug Report"] }),
      row({ sentiment: "neutral", status: "ACKNOWLEDGED", severityScore: 3, topics: ["Performance"] }),
      row({ sentiment: "negative", status: "ACTIONED", severityScore: 5, topics: ["Pricing"] }),
    ];

    const stats = aggregatePeriodStats(rows);

    expect(stats.totalItems).toBe(4);
    // 2/4 = 50%, 1/4 = 25%, 1/4 = 25%
    expect(stats.sentimentDistribution.positive).toBe(50);
    expect(stats.sentimentDistribution.neutral).toBe(25);
    expect(stats.sentimentDistribution.negative).toBe(25);
    // (2+4+3+5)/4 = 3.5
    expect(stats.avgSeverity).toBe(3.5);
    expect(stats.statusDistribution).toEqual({
      NEW: 2,
      ACKNOWLEDGED: 1,
      ACTIONED: 1,
    });
  });

  it("returns top 5 topics sorted by count descending then name", () => {
    const rows: ComparisonAnalysisRow[] = [
      row({ topics: ["A", "B", "C", "D", "E", "F"] }),
      row({ topics: ["A", "B", "C"] }),
      row({ topics: ["A", "B"] }),
      row({ topics: ["A"] }),
    ];

    const stats = aggregatePeriodStats(rows);

    // Counts: A=4, B=3, C=2, D=1, E=1, F=1 -> top 5 are A,B,C then D,E (tie at 1, alphabetical)
    expect(stats.topTopics).toHaveLength(5);
    expect(stats.topTopics[0]).toEqual({ topic: "A", count: 4 });
    expect(stats.topTopics[1]).toEqual({ topic: "B", count: 3 });
    expect(stats.topTopics[2]).toEqual({ topic: "C", count: 2 });
    expect(stats.topTopics[3]).toEqual({ topic: "D", count: 1 });
    expect(stats.topTopics[4]).toEqual({ topic: "E", count: 1 });
  });

  it("ignores non-string and non-array topic entries", () => {
    const rows: ComparisonAnalysisRow[] = [
      row({ topics: [123, "Valid", null, { x: 1 }, "Valid"] as unknown }),
    ];
    const stats = aggregatePeriodStats(rows);
    expect(stats.topTopics).toEqual([{ topic: "Valid", count: 2 }]);
  });

  it("ignores unknown sentiments but still counts them in totalItems", () => {
    const rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "positive" }),
      row({ sentiment: "mixed" }),
    ];
    const stats = aggregatePeriodStats(rows);
    expect(stats.totalItems).toBe(2);
    // Only 1 positive out of 2 -> 50%
    expect(stats.sentimentDistribution.positive).toBe(50);
    expect(stats.sentimentDistribution.neutral).toBe(0);
    expect(stats.sentimentDistribution.negative).toBe(0);
  });

  it("returns zeroed stats for empty input", () => {
    const stats = aggregatePeriodStats([]);
    expect(stats).toEqual(emptyStats);
  });
});

// ---------------------------------------------------------------------------
// calculateDeltas
// ---------------------------------------------------------------------------

describe("calculateDeltas", () => {
  it("computes positive deltas when period2 grew", () => {
    const p1: PeriodStats = {
      totalItems: 10,
      sentimentDistribution: { positive: 40, neutral: 30, negative: 30 },
      avgSeverity: 2.5,
      topTopics: [{ topic: "Bug Report", count: 4 }],
      statusDistribution: { NEW: 10 },
    };
    const p2: PeriodStats = {
      totalItems: 15,
      sentimentDistribution: { positive: 60, neutral: 20, negative: 20 },
      avgSeverity: 3.5,
      topTopics: [{ topic: "Bug Report", count: 8 }],
      statusDistribution: { NEW: 15 },
    };

    const deltas = calculateDeltas(p1, p2);

    expect(deltas.totalItems).toBe(5); // 15 - 10
    expect(deltas.positiveRate).toBe(20); // 60 - 40
    expect(deltas.avgSeverity).toBe(1); // 3.5 - 2.5
    expect(deltas.topTopics).toContainEqual({
      topic: "Bug Report",
      p1Count: 4,
      p2Count: 8,
      delta: 4,
    });
  });

  it("computes negative deltas when period2 shrank", () => {
    const p1: PeriodStats = {
      totalItems: 20,
      sentimentDistribution: { positive: 70, neutral: 20, negative: 10 },
      avgSeverity: 4.2,
      topTopics: [{ topic: "Pricing", count: 10 }],
      statusDistribution: {},
    };
    const p2: PeriodStats = {
      totalItems: 5,
      sentimentDistribution: { positive: 30, neutral: 30, negative: 40 },
      avgSeverity: 1.1,
      topTopics: [{ topic: "Pricing", count: 2 }],
      statusDistribution: {},
    };

    const deltas = calculateDeltas(p1, p2);

    expect(deltas.totalItems).toBe(-15); // 5 - 20
    expect(deltas.positiveRate).toBe(-40); // 30 - 70
    expect(deltas.avgSeverity).toBe(-3.1); // 1.1 - 4.2
    expect(deltas.topTopics[0]).toEqual({
      topic: "Pricing",
      p1Count: 10,
      p2Count: 2,
      delta: -8,
    });
  });

  it("computes zero deltas when both periods are identical", () => {
    const p: PeriodStats = {
      totalItems: 12,
      sentimentDistribution: { positive: 50, neutral: 25, negative: 25 },
      avgSeverity: 3,
      topTopics: [{ topic: "Bug Report", count: 6 }],
      statusDistribution: { NEW: 12 },
    };

    const deltas = calculateDeltas(p, p);

    expect(deltas.totalItems).toBe(0);
    expect(deltas.positiveRate).toBe(0);
    expect(deltas.avgSeverity).toBe(0);
    expect(deltas.topTopics).toHaveLength(1);
    expect(deltas.topTopics[0].delta).toBe(0);
  });

  it("computes zero deltas for two empty periods", () => {
    const deltas = calculateDeltas(emptyStats, emptyStats);
    expect(deltas.totalItems).toBe(0);
    expect(deltas.positiveRate).toBe(0);
    expect(deltas.avgSeverity).toBe(0);
    expect(deltas.topTopics).toEqual([]);
  });

  it("unions topics across both periods and fills missing counts with zero", () => {
    const p1: PeriodStats = {
      ...emptyStats,
      topTopics: [
        { topic: "A", count: 5 },
        { topic: "B", count: 3 },
      ],
    };
    const p2: PeriodStats = {
      ...emptyStats,
      topTopics: [
        { topic: "B", count: 1 },
        { topic: "C", count: 4 },
      ],
    };

    const deltas = calculateDeltas(p1, p2);
    const byTopic = new Map(deltas.topTopics.map((t) => [t.topic, t]));

    expect(byTopic.get("A")).toEqual({ topic: "A", p1Count: 5, p2Count: 0, delta: -5 });
    expect(byTopic.get("B")).toEqual({ topic: "B", p1Count: 3, p2Count: 1, delta: -2 });
    expect(byTopic.get("C")).toEqual({ topic: "C", p1Count: 0, p2Count: 4, delta: 4 });
  });

  it("sorts topic deltas by absolute magnitude descending", () => {
    const p1: PeriodStats = {
      ...emptyStats,
      topTopics: [
        { topic: "small", count: 10 },
        { topic: "big", count: 1 },
      ],
    };
    const p2: PeriodStats = {
      ...emptyStats,
      topTopics: [
        { topic: "big", count: 11 },
        { topic: "small", count: 9 },
      ],
    };

    const deltas = calculateDeltas(p1, p2);
    // big delta = +10, small delta = -1 -> big first
    expect(deltas.topTopics[0].topic).toBe("big");
    expect(deltas.topTopics[0].delta).toBe(10);
    expect(deltas.topTopics[1].topic).toBe("small");
    expect(deltas.topTopics[1].delta).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// comparePeriods (mocked prisma)
// ---------------------------------------------------------------------------

describe("comparePeriods", () => {
  beforeEach(() => {
    mockFeedbackFindMany.mockReset();
  });

  it("queries both periods and returns period1/period2/deltas structure", async () => {
    const period1Rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "positive", status: "NEW", severityScore: 2, topics: ["Bug Report"] }),
      row({ sentiment: "negative", status: "NEW", severityScore: 4, topics: ["Pricing"] }),
    ];
    const period2Rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "positive", status: "ACTIONED", severityScore: 1, topics: ["Bug Report"] }),
      row({ sentiment: "positive", status: "ACTIONED", severityScore: 2, topics: ["Bug Report"] }),
      row({ sentiment: "neutral", status: "NEW", severityScore: 3, topics: ["Performance"] }),
    ];

    mockFeedbackFindMany
      .mockResolvedValueOnce(period1Rows)
      .mockResolvedValueOnce(period2Rows);

    const start1 = new Date("2024-01-01T00:00:00Z");
    const end1 = new Date("2024-01-31T23:59:59Z");
    const start2 = new Date("2024-02-01T00:00:00Z");
    const end2 = new Date("2024-02-29T23:59:59Z");

    const result = await comparePeriods(start1, end1, start2, end2);

    // Two findMany calls — one per period.
    expect(mockFeedbackFindMany).toHaveBeenCalledTimes(2);

    // First call filtered on period1 range.
    const call1Where = mockFeedbackFindMany.mock.calls[0][0].where;
    expect(call1Where.feedbackItem.originalTimestamp.gte).toBe(start1);
    expect(call1Where.feedbackItem.originalTimestamp.lte).toBe(end1);

    // Second call filtered on period2 range.
    const call2Where = mockFeedbackFindMany.mock.calls[1][0].where;
    expect(call2Where.feedbackItem.originalTimestamp.gte).toBe(start2);
    expect(call2Where.feedbackItem.originalTimestamp.lte).toBe(end2);

    // Structure checks.
    expect(result.period1.totalItems).toBe(2);
    expect(result.period2.totalItems).toBe(3);
    expect(result.deltas.totalItems).toBe(1); // 3 - 2
    // period1 positive = 1/2 = 50%; period2 positive = 2/3 = 66.7%
    expect(result.deltas.positiveRate).toBe(16.7); // 66.7 - 50
    expect(result.period1.sentimentDistribution.positive).toBe(50);
    expect(result.period2.sentimentDistribution.positive).toBe(66.7);
    expect(result.deltas.positiveRate).toBe(16.7);
  });

  it("handles empty data for both periods", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([]);
    mockFeedbackFindMany.mockResolvedValueOnce([]);

    const result = await comparePeriods(
      new Date("2024-01-01"),
      new Date("2024-01-31"),
      new Date("2024-02-01"),
      new Date("2024-02-29")
    );

    expect(result.period1).toEqual(emptyStats);
    expect(result.period2).toEqual(emptyStats);
    expect(result.deltas.totalItems).toBe(0);
    expect(result.deltas.positiveRate).toBe(0);
    expect(result.deltas.avgSeverity).toBe(0);
    expect(result.deltas.topTopics).toEqual([]);
  });

  it("handles empty period1 and populated period2", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([]);
    mockFeedbackFindMany.mockResolvedValueOnce([
      row({ sentiment: "positive", severityScore: 3, topics: ["Bug Report"] }),
    ]);

    const result = await comparePeriods(
      new Date("2024-01-01"),
      new Date("2024-01-31"),
      new Date("2024-02-01"),
      new Date("2024-02-29")
    );

    expect(result.period1.totalItems).toBe(0);
    expect(result.period2.totalItems).toBe(1);
    expect(result.deltas.totalItems).toBe(1);
    expect(result.deltas.positiveRate).toBe(100); // 100 - 0
  });
});

// ---------------------------------------------------------------------------
// compareSources (mocked prisma)
// ---------------------------------------------------------------------------

describe("compareSources", () => {
  beforeEach(() => {
    mockFeedbackFindMany.mockReset();
  });

  it("queries both sources over the same trailing window and returns metadata", async () => {
    const source1Rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "negative", status: "NEW", severityScore: 5, topics: ["Bug Report"] }),
    ];
    const source2Rows: ComparisonAnalysisRow[] = [
      row({ sentiment: "positive", status: "ACTIONED", severityScore: 1, topics: ["Feature Request"] }),
      row({ sentiment: "positive", status: "ACTIONED", severityScore: 2, topics: ["Feature Request"] }),
    ];

    mockFeedbackFindMany
      .mockResolvedValueOnce(source1Rows)
      .mockResolvedValueOnce(source2Rows);

    const result = await compareSources("GitHubIssues", "Trustpilot", 30);

    expect(result.source1).toBe("GitHubIssues");
    expect(result.source2).toBe("Trustpilot");
    expect(result.days).toBe(30);

    // Two findMany calls — one per source.
    expect(mockFeedbackFindMany).toHaveBeenCalledTimes(2);

    const call1Where = mockFeedbackFindMany.mock.calls[0][0].where;
    expect(call1Where.feedbackItem.source).toBe("GitHubIssues");
    expect(call1Where.feedbackItem.originalTimestamp.gte).toBeInstanceOf(Date);

    const call2Where = mockFeedbackFindMany.mock.calls[1][0].where;
    expect(call2Where.feedbackItem.source).toBe("Trustpilot");
    expect(call2Where.feedbackItem.originalTimestamp.gte).toBeInstanceOf(Date);

    // The cutoff for both calls should match (same trailing window).
    expect(call1Where.feedbackItem.originalTimestamp.gte.getTime()).toBe(
      call2Where.feedbackItem.originalTimestamp.gte.getTime()
    );

    expect(result.period1.totalItems).toBe(1);
    expect(result.period2.totalItems).toBe(2);
    expect(result.deltas.totalItems).toBe(1);
  });

  it("uses a 30-day default window when days is omitted", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([]);
    mockFeedbackFindMany.mockResolvedValueOnce([]);

    await compareSources("A", "B");

    const where = mockFeedbackFindMany.mock.calls[0][0].where;
    const cutoff = where.feedbackItem.originalTimestamp.gte as Date;
    const approxDays =
      (Date.now() - cutoff.getTime()) / (1000 * 60 * 60 * 24);
    expect(approxDays).toBeCloseTo(30, 1);
  });

  it("handles both sources having no data", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([]);
    mockFeedbackFindMany.mockResolvedValueOnce([]);

    const result = await compareSources("Empty1", "Empty2", 7);

    expect(result.period1).toEqual(emptyStats);
    expect(result.period2).toEqual(emptyStats);
    expect(result.deltas.totalItems).toBe(0);
    expect(result.deltas.topTopics).toEqual([]);
  });

  it("handles one source empty and the other populated", async () => {
    mockFeedbackFindMany.mockResolvedValueOnce([]);
    mockFeedbackFindMany.mockResolvedValueOnce([
      row({ sentiment: "positive", severityScore: 2, topics: ["UX/UI"] }),
      row({ sentiment: "positive", severityScore: 4, topics: ["UX/UI"] }),
    ]);

    const result = await compareSources("Empty", "Full", 14);

    expect(result.period1.totalItems).toBe(0);
    expect(result.period2.totalItems).toBe(2);
    expect(result.period2.sentimentDistribution.positive).toBe(100);
    expect(result.deltas.totalItems).toBe(2);
    expect(result.deltas.positiveRate).toBe(100); // 100 - 0
  });
});
