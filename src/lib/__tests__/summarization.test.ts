import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so summarization logic can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the LLM so no real model call is made.
vi.mock("@/lib/llm", () => ({
  chatJson: vi.fn(),
}));

import {
  summarizeFeedback,
  summarizeBySource,
  buildSummaryUserPrompt,
  normalizeSummaryResult,
  validateSummaryItemIds,
  rangeStartDate,
  MAX_SUMMARY_ITEMS,
  type FeedbackSummaryResult,
} from "@/lib/summarization";
import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

const feedbackFindMany = vi.mocked(prisma.feedbackItem.findMany);
const chatJsonMock = vi.mocked(chatJson);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItem(overrides: Partial<{
  id: string;
  source: string;
  title: string | null;
  rawContent: string;
  authorLogin: string | null;
  originalTimestamp: Date;
  analysis: {
    sentiment: string;
    topics: unknown;
    severityScore: number;
    summary: string;
    emotion: string | null;
    actionItems: unknown;
  } | null;
}> = {}) {
  return {
    id: "item-1",
    source: "github",
    title: "Login broken",
    rawContent: "I cannot log in, it redirects in a loop.",
    authorLogin: "alice",
    originalTimestamp: new Date("2024-06-01T00:00:00Z"),
    analysis: {
      sentiment: "negative",
      topics: ["Bug Report", "Authentication"],
      severityScore: 4,
      summary: "Login redirect loop prevents access.",
      emotion: "frustrated",
      actionItems: ["Fix login redirect loop"],
    },
    ...overrides,
  };
}

function makeSummaryResult(
  overrides: Partial<FeedbackSummaryResult> = {}
): FeedbackSummaryResult {
  return {
    executiveSummary: "Customers report a critical login issue.",
    keyFindings: ["Login redirect loop is the top complaint"],
    sentimentBreakdown: { positive: 0, neutral: 1, negative: 4 },
    topIssues: ["Login redirect loop"],
    recommendations: ["Patch the auth redirect immediately"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  feedbackFindMany.mockReset();
  chatJsonMock.mockReset();
});

// ---------------------------------------------------------------------------
// validateSummaryItemIds
// ---------------------------------------------------------------------------

describe("validateSummaryItemIds", () => {
  it("accepts a valid non-empty array of strings", () => {
    const result = validateSummaryItemIds(["a", "b"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ids).toEqual(["a", "b"]);
  });

  it("rejects a non-array", () => {
    const result = validateSummaryItemIds("not-an-array");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty array", () => {
    const result = validateSummaryItemIds([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/i);
  });

  it("rejects arrays exceeding the max batch size", () => {
    const ids = Array.from({ length: MAX_SUMMARY_ITEMS + 1 }, (_, i) => `id-${i}`);
    const result = validateSummaryItemIds(ids);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_SUMMARY_ITEMS));
  });

  it("rejects arrays containing non-string or empty entries", () => {
    const result = validateSummaryItemIds(["ok", "", 123]);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// rangeStartDate
// ---------------------------------------------------------------------------

describe("rangeStartDate", () => {
  it("returns a date ~N days ago for a positive N", () => {
    const start = rangeStartDate(7)!;
    const diffDays = (Date.now() - start.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);
  });

  it("returns null for non-positive or invalid days", () => {
    expect(rangeStartDate(0)).toBeNull();
    expect(rangeStartDate(-5)).toBeNull();
    expect(rangeStartDate(NaN)).toBeNull();
    expect(rangeStartDate(Infinity)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// summarizeFeedback
// ---------------------------------------------------------------------------

describe("summarizeFeedback", () => {
  it("fetches items by id, calls the LLM, and returns a normalized summary", async () => {
    feedbackFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue(makeSummaryResult());

    const result = await summarizeFeedback(["item-1"]);

    // Queried by id with the analysis relation included.
    const call = feedbackFindMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
      include: { analysis: { select: Record<string, boolean> } };
    };
    expect(call.where.id.in).toEqual(["item-1"]);
    expect(call.include.analysis.select).toEqual({
      sentiment: true,
      topics: true,
      severityScore: true,
      summary: true,
      emotion: true,
      actionItems: true,
    });

    // LLM called once with the system + user prompt.
    expect(chatJsonMock).toHaveBeenCalledTimes(1);
    const [systemPrompt, userPrompt] = chatJsonMock.mock.calls[0];
    expect(systemPrompt).toContain("product analyst");
    expect(systemPrompt).toContain("executiveSummary");
    expect(systemPrompt).toContain("sentimentBreakdown");
    expect(systemPrompt).toContain("recommendations");

    // User prompt is JSON containing the feedback payload.
    const parsed = JSON.parse(userPrompt);
    expect(parsed.totalItems).toBe(1);
    expect(parsed.feedbackItems[0].id).toBe("item-1");

    // Result is normalized.
    expect(result.executiveSummary).toBe("Customers report a critical login issue.");
    expect(result.keyFindings).toHaveLength(1);
    expect(result.sentimentBreakdown).toEqual({ positive: 0, neutral: 1, negative: 4 });
  });

  it("throws on an empty id array without hitting the DB or LLM", async () => {
    await expect(summarizeFeedback([])).rejects.toThrow(/empty/i);
    expect(feedbackFindMany).not.toHaveBeenCalled();
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("throws when no feedback items are found for the given ids", async () => {
    feedbackFindMany.mockResolvedValue([] as never);
    await expect(summarizeFeedback(["missing"])).rejects.toThrow(/No feedback items found/i);
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("propagates LLM errors", async () => {
    feedbackFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockRejectedValue(new Error("LLM down"));

    await expect(summarizeFeedback(["item-1"])).rejects.toThrow("LLM down");
  });

  it("normalizes malformed LLM output defensively", async () => {
    feedbackFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue({
      executiveSummary: 42,
      keyFindings: "not an array",
      sentimentBreakdown: { positive: "x", negative: 3 },
      topIssues: null,
      recommendations: undefined,
    });

    const result = await summarizeFeedback(["item-1"]);
    expect(result.executiveSummary).toBe("");
    expect(result.keyFindings).toEqual([]);
    expect(result.sentimentBreakdown).toEqual({ positive: 0, neutral: 0, negative: 3 });
    expect(result.topIssues).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// summarizeBySource
// ---------------------------------------------------------------------------

describe("summarizeBySource", () => {
  it("filters by source and a gte originalTimestamp within the time range", async () => {
    feedbackFindMany.mockResolvedValue([makeItem({ source: "slack" })] as never);
    chatJsonMock.mockResolvedValue(makeSummaryResult());

    await summarizeBySource("slack", 7);

    const call = feedbackFindMany.mock.calls[0][0] as {
      where: { source: string; originalTimestamp?: { gte: Date } };
      orderBy: { originalTimestamp: string };
      take: number;
    };
    expect(call.where.source).toBe("slack");
    expect(call.where.originalTimestamp).toBeDefined();
    expect(call.where.originalTimestamp!.gte).toBeInstanceOf(Date);
    expect(call.orderBy.originalTimestamp).toBe("desc");
    expect(call.take).toBe(MAX_SUMMARY_ITEMS);

    // The gte date should be ~7 days ago.
    const diffDays =
      (Date.now() - call.where.originalTimestamp!.gte.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeGreaterThan(6.9);
    expect(diffDays).toBeLessThan(7.1);

    expect(chatJsonMock).toHaveBeenCalledTimes(1);
  });

  it("omits the date filter when days is non-positive (all-time)", async () => {
    feedbackFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue(makeSummaryResult());

    await summarizeBySource("github", 0);

    const call = feedbackFindMany.mock.calls[0][0] as {
      where: { source: string; originalTimestamp?: { gte: Date } };
    };
    expect(call.where.source).toBe("github");
    expect(call.where.originalTimestamp).toBeUndefined();
  });

  it("throws when no items are found for the source in the window", async () => {
    feedbackFindMany.mockResolvedValue([] as never);
    await expect(summarizeBySource("zendesk", 30)).rejects.toThrow(/No feedback items found/i);
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("throws on an empty source string", async () => {
    await expect(summarizeBySource("", 7)).rejects.toThrow(/source/i);
    expect(feedbackFindMany).not.toHaveBeenCalled();
  });

  it("passes the fetched items to the LLM and returns the normalized summary", async () => {
    feedbackFindMany.mockResolvedValue([
      makeItem({ id: "a", source: "slack" }),
      makeItem({ id: "b", source: "slack", analysis: null }),
    ] as never);
    chatJsonMock.mockResolvedValue(makeSummaryResult());

    const result = await summarizeBySource("slack", 7);

    const userPrompt = chatJsonMock.mock.calls[0][1];
    const parsed = JSON.parse(userPrompt);
    expect(parsed.totalItems).toBe(2);
    // Items without an analysis should serialize analysis as null.
    expect(parsed.feedbackItems[1].analysis).toBeNull();
    expect(result.executiveSummary).toBe("Customers report a critical login issue.");
  });
});

// ---------------------------------------------------------------------------
// buildSummaryUserPrompt (prompt construction)
// ---------------------------------------------------------------------------

describe("buildSummaryUserPrompt", () => {
  it("serializes each item with id, source, title, author, content, timestamp, and analysis", () => {
    const item = makeItem();
    const prompt = buildSummaryUserPrompt([item]);
    const parsed = JSON.parse(prompt);

    expect(parsed.totalItems).toBe(1);
    const entry = parsed.feedbackItems[0];
    expect(entry.item).toBe(1);
    expect(entry.id).toBe("item-1");
    expect(entry.source).toBe("github");
    expect(entry.title).toBe("Login broken");
    expect(entry.author).toBe("alice");
    expect(entry.content).toContain("cannot log in");
    expect(entry.timestamp).toBe(item.originalTimestamp.toISOString());
    expect(entry.analysis.sentiment).toBe("negative");
    expect(entry.analysis.topics).toEqual(["Bug Report", "Authentication"]);
    expect(entry.analysis.severityScore).toBe(4);
    expect(entry.analysis.actionItems).toEqual(["Fix login redirect loop"]);
  });

  it("filters out non-string topics and action items", () => {
    const item = makeItem({
      analysis: {
        sentiment: "negative",
        topics: ["Bug Report", 123, null, "Auth"],
        severityScore: 3,
        summary: "broken",
        emotion: null,
        actionItems: ["Fix it", 42, "Deploy patch"],
      },
    });
    const prompt = buildSummaryUserPrompt([item]);
    const parsed = JSON.parse(prompt);

    expect(parsed.feedbackItems[0].analysis.topics).toEqual(["Bug Report", "Auth"]);
    expect(parsed.feedbackItems[0].analysis.actionItems).toEqual(["Fix it", "Deploy patch"]);
  });

  it("serializes analysis as null when absent", () => {
    const item = makeItem({ analysis: null });
    const prompt = buildSummaryUserPrompt([item]);
    const parsed = JSON.parse(prompt);
    expect(parsed.feedbackItems[0].analysis).toBeNull();
  });

  it("uses null for missing title/author", () => {
    const item = makeItem({ title: null, authorLogin: null });
    const prompt = buildSummaryUserPrompt([item]);
    const parsed = JSON.parse(prompt);
    expect(parsed.feedbackItems[0].title).toBeNull();
    expect(parsed.feedbackItems[0].author).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeSummaryResult
// ---------------------------------------------------------------------------

describe("normalizeSummaryResult", () => {
  it("passes through a well-formed result", () => {
    const result = normalizeSummaryResult(makeSummaryResult());
    expect(result).toEqual(makeSummaryResult());
  });

  it("defaults missing fields to empty strings/arrays and zeroed breakdown", () => {
    const result = normalizeSummaryResult({});
    expect(result.executiveSummary).toBe("");
    expect(result.keyFindings).toEqual([]);
    expect(result.sentimentBreakdown).toEqual({ positive: 0, neutral: 0, negative: 0 });
    expect(result.topIssues).toEqual([]);
    expect(result.recommendations).toEqual([]);
  });
});
