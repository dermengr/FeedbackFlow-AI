import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so insights logic can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
    aiInsight: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock the LLM so no real model call is made.
vi.mock("@/lib/llm", () => ({
  chatJson: vi.fn(),
}));

import {
  aggregateAnalyses,
  generateInsights,
  get_cached_insights,
  getFreshCachedInsights,
  normalizeTimeRange,
  rangeStartDate,
  INSIGHTS_TYPE,
  CACHE_FRESH_MS,
} from "@/lib/insights";
import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

const analysisFindMany = vi.mocked(prisma.feedbackAnalysis.findMany);
const insightFindFirst = vi.mocked(prisma.aiInsight.findFirst);
const insightCreate = vi.mocked(prisma.aiInsight.create);
const chatJsonMock = vi.mocked(chatJson);

function makeAnalysis(overrides: Partial<{
  sentiment: string;
  status: string;
  emotion: string | null;
  topics: unknown;
  severityScore: number;
  summary: string | null;
}> = {}) {
  return {
    sentiment: "negative",
    status: "NEW",
    emotion: "frustrated",
    topics: ["Bug Report", "Performance"],
    severityScore: 3,
    summary: "Something went wrong",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  analysisFindMany.mockReset();
  insightFindFirst.mockReset();
  insightCreate.mockReset();
  chatJsonMock.mockReset();
});

// ---------------------------------------------------------------------------
// Time range helpers
// ---------------------------------------------------------------------------

describe("normalizeTimeRange", () => {
  it("accepts valid ranges 7d, 30d, all", () => {
    expect(normalizeTimeRange("7d")).toBe("7d");
    expect(normalizeTimeRange("30d")).toBe("30d");
    expect(normalizeTimeRange("all")).toBe("all");
  });

  it("defaults to 7d for invalid or missing input", () => {
    expect(normalizeTimeRange(null)).toBe("7d");
    expect(normalizeTimeRange(undefined)).toBe("7d");
    expect(normalizeTimeRange("99d")).toBe("7d");
    expect(normalizeTimeRange("")).toBe("7d");
  });
});

describe("rangeStartDate", () => {
  it("returns a date ~7 days ago for 7d", () => {
    const start = rangeStartDate("7d")!;
    const diffDays = (Date.now() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("returns a date ~30 days ago for 30d", () => {
    const start = rangeStartDate("30d")!;
    const diffDays = (Date.now() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(29.9);
    expect(diffDays).toBeLessThan(30.1);
  });

  it("returns null for all (no lower bound)", () => {
    expect(rangeStartDate("all")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Aggregation logic
// ---------------------------------------------------------------------------

describe("aggregateAnalyses", () => {
  it("returns zeroed aggregation for empty input", () => {
    const agg = aggregateAnalyses([]);
    expect(agg.total).toBe(0);
    expect(agg.averageSeverity).toBe(0);
    expect(agg.highSeverityCount).toBe(0);
    expect(agg.bySentiment).toEqual({});
    expect(agg.byTopic).toEqual({});
    expect(agg.topSummaries).toEqual([]);
  });

  it("counts sentiment, status, emotion, and topics", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ sentiment: "positive", status: "ACTIONED", emotion: "happy", topics: ["Bug Report", "UX/UI"] }),
      makeAnalysis({ sentiment: "negative", status: "NEW", emotion: "frustrated", topics: ["Bug Report"] }),
      makeAnalysis({ sentiment: "negative", status: "NEW", emotion: null, topics: ["Performance"] }),
    ]);

    expect(agg.total).toBe(3);
    expect(agg.bySentiment).toEqual({ positive: 1, negative: 2 });
    expect(agg.byStatus).toEqual({ ACTIONED: 1, NEW: 2 });
    expect(agg.byEmotion).toEqual({ happy: 1, frustrated: 1 });
    expect(agg.byTopic).toEqual({
      "Bug Report": 2,
      "UX/UI": 1,
      Performance: 1,
    });
  });

  it("computes average severity rounded to 2 decimals", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ severityScore: 1 }),
      makeAnalysis({ severityScore: 2 }),
      makeAnalysis({ severityScore: 4 }),
    ]);
    // (1+2+4)/3 = 2.333... -> 2.33
    expect(agg.averageSeverity).toBe(2.33);
  });

  it("counts high-severity items (severity >= 4)", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ severityScore: 3 }),
      makeAnalysis({ severityScore: 4 }),
      makeAnalysis({ severityScore: 5 }),
      makeAnalysis({ severityScore: 1 }),
    ]);
    expect(agg.highSeverityCount).toBe(2);
  });

  it("ignores non-string topic entries", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ topics: ["Bug Report", 123, null, "Performance"] as unknown }),
    ]);
    expect(agg.byTopic).toEqual({ "Bug Report": 1, Performance: 1 });
  });

  it("handles non-array topics gracefully", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ topics: "not-an-array" }),
    ]);
    expect(agg.byTopic).toEqual({});
  });

  it("collects up to 20 summaries", () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeAnalysis({ summary: `summary ${i}` })
    );
    const agg = aggregateAnalyses(items);
    expect(agg.topSummaries).toHaveLength(20);
    expect(agg.topSummaries[0]).toBe("summary 0");
  });

  it("skips null summaries", () => {
    const agg = aggregateAnalyses([
      makeAnalysis({ summary: null }),
      makeAnalysis({ summary: "real summary" }),
    ]);
    expect(agg.topSummaries).toEqual(["real summary"]);
  });
});

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

describe("get_cached_insights", () => {
  it("returns null when no cached record exists", async () => {
    insightFindFirst.mockResolvedValue(null);
    const result = await get_cached_insights("7d");
    expect(result).toBeNull();
    expect(insightFindFirst).toHaveBeenCalledWith({
      where: { type: INSIGHTS_TYPE, timeRange: "7d" },
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns data + createdAt when a cached record exists", async () => {
    const createdAt = new Date("2024-01-01T00:00:00Z");
    const data = { summary: "cached", highlights: [], recommendations: [], trendingTopics: [] };
    insightFindFirst.mockResolvedValue({
      id: "1",
      type: INSIGHTS_TYPE,
      timeRange: "7d",
      data,
      createdAt,
    } as never);

    const result = await get_cached_insights("7d");
    expect(result).not.toBeNull();
    expect(result!.data.summary).toBe("cached");
    expect(result!.createdAt).toEqual(createdAt);
  });
});

describe("getFreshCachedInsights", () => {
  it("returns cached data when record is < 1 hour old", async () => {
    const fresh = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
    const data = { summary: "fresh", highlights: [], recommendations: [], trendingTopics: [] };
    insightFindFirst.mockResolvedValue({
      id: "1",
      type: INSIGHTS_TYPE,
      timeRange: "7d",
      data,
      createdAt: fresh,
    } as never);

    const result = await getFreshCachedInsights("7d");
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("fresh");
  });

  it("returns null when record is older than 1 hour (stale)", async () => {
    const stale = new Date(Date.now() - (CACHE_FRESH_MS + 60 * 1000)); // > 1h ago
    const data = { summary: "stale", highlights: [], recommendations: [], trendingTopics: [] };
    insightFindFirst.mockResolvedValue({
      id: "1",
      type: INSIGHTS_TYPE,
      timeRange: "7d",
      data,
      createdAt: stale,
    } as never);

    const result = await getFreshCachedInsights("7d");
    expect(result).toBeNull();
  });

  it("returns null when no cached record exists", async () => {
    insightFindFirst.mockResolvedValue(null);
    const result = await getFreshCachedInsights("30d");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// generateInsights
// ---------------------------------------------------------------------------

describe("generateInsights", () => {
  it("queries with a gte date filter for 7d range", async () => {
    analysisFindMany.mockResolvedValue([]);
    insightCreate.mockResolvedValue({} as never);

    await generateInsights("7d");

    const call = analysisFindMany.mock.calls[0][0] as {
      where: { createdAt?: { gte: Date } };
      select: Record<string, boolean>;
    };
    expect(call.where.createdAt).toBeDefined();
    expect(call.where.createdAt!.gte).toBeInstanceOf(Date);
    // select only the fields needed for aggregation
    expect(call.select).toEqual({
      sentiment: true,
      status: true,
      emotion: true,
      topics: true,
      severityScore: true,
      summary: true,
    });
  });

  it("queries with no date filter for all range", async () => {
    analysisFindMany.mockResolvedValue([]);
    insightCreate.mockResolvedValue({} as never);

    await generateInsights("all");

    const call = analysisFindMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    // "all" should produce an empty where object (no createdAt bound)
    expect(call.where).toEqual({});
  });

  it("returns an empty result and caches it when there is no feedback", async () => {
    analysisFindMany.mockResolvedValue([]);
    insightCreate.mockResolvedValue({} as never);

    const result = await generateInsights("7d");

    expect(result).toEqual({
      summary: "No feedback data available for the selected time range.",
      highlights: [],
      recommendations: [],
      trendingTopics: [],
    });
    // Should NOT call the LLM when there's no data.
    expect(chatJsonMock).not.toHaveBeenCalled();
    // Should still cache the empty result.
    expect(insightCreate).toHaveBeenCalledTimes(1);
    const created = insightCreate.mock.calls[0][0] as {
      data: { type: string; timeRange: string; data: { summary: string } };
    };
    expect(created.data.type).toBe(INSIGHTS_TYPE);
    expect(created.data.timeRange).toBe("7d");
    expect(created.data.data.summary).toContain("No feedback data available");
  });

  it("aggregates data, calls the LLM, normalizes, and caches the result", async () => {
    analysisFindMany.mockResolvedValue([
      makeAnalysis({ sentiment: "negative", severityScore: 5, topics: ["Bug Report"] }),
      makeAnalysis({ sentiment: "positive", severityScore: 2, topics: ["Feature Request"] }),
    ] as never);

    chatJsonMock.mockResolvedValue({
      summary: "Overall mixed feedback.",
      highlights: ["Bug reports dominate", "Some positive feature requests"],
      recommendations: ["Triage critical bugs first"],
      trendingTopics: ["Bug Report", "Feature Request"],
    });

    insightCreate.mockResolvedValue({} as never);

    const result = await generateInsights("30d");

    // LLM was called once with the system + user prompt.
    expect(chatJsonMock).toHaveBeenCalledTimes(1);
    const [systemPrompt, userPrompt] = chatJsonMock.mock.calls[0];
    expect(systemPrompt).toContain("weekly insights summary");
    expect(systemPrompt).toContain("summary");
    expect(systemPrompt).toContain("highlights");
    expect(systemPrompt).toContain("recommendations");
    expect(systemPrompt).toContain("trendingTopics");
    // User prompt should contain aggregated stats as JSON.
    const parsed = JSON.parse(userPrompt);
    expect(parsed.totalAnalyses).toBe(2);
    expect(parsed.sentimentBreakdown).toEqual({ negative: 1, positive: 1 });

    // Result is normalized.
    expect(result.summary).toBe("Overall mixed feedback.");
    expect(result.highlights).toHaveLength(2);
    expect(result.recommendations).toEqual(["Triage critical bugs first"]);
    expect(result.trendingTopics).toEqual(["Bug Report", "Feature Request"]);

    // Cached.
    expect(insightCreate).toHaveBeenCalledTimes(1);
    const created = insightCreate.mock.calls[0][0] as {
      data: {
        type: string;
        timeRange: string;
        data: { summary: string };
      };
    };
    expect(created.data.type).toBe(INSIGHTS_TYPE);
    expect(created.data.timeRange).toBe("30d");
    expect(created.data.data.summary).toBe("Overall mixed feedback.");
  });

  it("normalizes missing/incorrect LLM fields defensively", async () => {
    analysisFindMany.mockResolvedValue([makeAnalysis()] as never);
    // LLM returns malformed data: missing arrays, non-string summary.
    chatJsonMock.mockResolvedValue({
      summary: 42,
      highlights: "not an array",
      recommendations: null,
      trendingTopics: ["ok"],
    });
    insightCreate.mockResolvedValue({} as never);

    const result = await generateInsights("7d");

    expect(result.summary).toBe("");
    expect(result.highlights).toEqual([]);
    expect(result.recommendations).toEqual([]);
    expect(result.trendingTopics).toEqual(["ok"]);
  });
});
