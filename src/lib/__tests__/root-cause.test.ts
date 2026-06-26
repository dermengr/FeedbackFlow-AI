import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so root-cause logic can be exercised without a DB.
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
  analyzeRootCause,
  getRootCauseAnalysis,
  buildRootCauseUserPrompt,
  validateRootCauseItemIds,
  MAX_ROOT_CAUSE_ITEMS,
} from "@/lib/root-cause";
import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

const feedbackItemFindMany = vi.mocked(prisma.feedbackItem.findMany);
const chatJsonMock = vi.mocked(chatJson);

function makeItem(overrides: Partial<{
  id: string;
  title: string | null;
  analysis: {
    sentiment: string;
    topics: unknown;
    summary: string;
  } | null;
}> = {}) {
  return {
    id: "item-1",
    title: "Login broken",
    analysis: {
      sentiment: "negative",
      topics: ["Bug Report", "Authentication"],
      summary: "Users cannot log in due to a redirect loop.",
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  feedbackItemFindMany.mockReset();
  chatJsonMock.mockReset();
});

// ---------------------------------------------------------------------------
// validateRootCauseItemIds
// ---------------------------------------------------------------------------

describe("validateRootCauseItemIds", () => {
  it("accepts a non-empty array of strings", () => {
    const result = validateRootCauseItemIds(["a", "b", "c"]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.ids).toEqual(["a", "b", "c"]);
  });

  it("rejects a non-array value", () => {
    const result = validateRootCauseItemIds("not-an-array");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/array/);
  });

  it("rejects an empty array", () => {
    const result = validateRootCauseItemIds([]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/empty/);
  });

  it(`rejects more than ${MAX_ROOT_CAUSE_ITEMS} items`, () => {
    const ids = Array.from({ length: MAX_ROOT_CAUSE_ITEMS + 1 }, (_, i) => `id-${i}`);
    const result = validateRootCauseItemIds(ids);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/at most/);
  });

  it("accepts exactly the maximum number of items", () => {
    const ids = Array.from({ length: MAX_ROOT_CAUSE_ITEMS }, (_, i) => `id-${i}`);
    const result = validateRootCauseItemIds(ids);
    expect(result.ok).toBe(true);
  });

  it("rejects non-string or empty-string entries", () => {
    const result = validateRootCauseItemIds(["a", "", 123 as unknown as string]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/non-empty strings/);
  });
});

// ---------------------------------------------------------------------------
// buildRootCauseUserPrompt
// ---------------------------------------------------------------------------

describe("buildRootCauseUserPrompt", () => {
  it("produces valid JSON containing summaries, sentiments, and topics", () => {
    const prompt = buildRootCauseUserPrompt([
      {
        id: "1",
        title: "Login broken",
        summary: "Users cannot log in.",
        sentiment: "negative",
        topics: ["Bug Report", "Authentication"],
      },
      {
        id: "2",
        title: null,
        summary: null,
        sentiment: null,
        topics: [],
      },
    ]);

    const parsed = JSON.parse(prompt);
    expect(parsed.totalItems).toBe(2);
    expect(parsed.feedbackItems).toHaveLength(2);
    expect(parsed.feedbackItems[0].summary).toBe("Users cannot log in.");
    expect(parsed.feedbackItems[0].sentiment).toBe("negative");
    expect(parsed.feedbackItems[0].topics).toEqual(["Bug Report", "Authentication"]);
  });

  it("handles missing analysis fields by substituting nulls", () => {
    const prompt = buildRootCauseUserPrompt([
      { id: "1", title: null, summary: null, sentiment: null, topics: [] },
    ]);
    const parsed = JSON.parse(prompt);
    expect(parsed.feedbackItems[0].summary).toBeNull();
    expect(parsed.feedbackItems[0].sentiment).toBeNull();
    expect(parsed.feedbackItems[0].topics).toEqual([]);
  });

  it("filters out non-string topic entries", () => {
    const prompt = buildRootCauseUserPrompt([
      {
        id: "1",
        title: "t",
        summary: "s",
        sentiment: "negative",
        topics: ["Bug Report", 42, null, "Performance"] as unknown,
      },
    ]);
    const parsed = JSON.parse(prompt);
    expect(parsed.feedbackItems[0].topics).toEqual(["Bug Report", "Performance"]);
  });

  it("handles non-array topics gracefully", () => {
    const prompt = buildRootCauseUserPrompt([
      {
        id: "1",
        title: "t",
        summary: "s",
        sentiment: "negative",
        topics: "not-an-array",
      },
    ]);
    const parsed = JSON.parse(prompt);
    expect(parsed.feedbackItems[0].topics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// analyzeRootCause
// ---------------------------------------------------------------------------

describe("analyzeRootCause", () => {
  it("throws on an empty array without querying the DB or LLM", async () => {
    await expect(analyzeRootCause([])).rejects.toThrow(/empty/);
    expect(feedbackItemFindMany).not.toHaveBeenCalled();
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("throws when too many items are requested", async () => {
    const ids = Array.from(
      { length: MAX_ROOT_CAUSE_ITEMS + 1 },
      (_, i) => `id-${i}`
    );
    await expect(analyzeRootCause(ids)).rejects.toThrow(/at most/);
    expect(feedbackItemFindMany).not.toHaveBeenCalled();
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("fetches items, calls the LLM, and returns a normalized result", async () => {
    feedbackItemFindMany.mockResolvedValue([
      makeItem({ id: "a" }),
      makeItem({ id: "b", title: "Crash on startup" }),
    ] as never);

    chatJsonMock.mockResolvedValue({
      rootCauses: ["Auth redirect loop", "Missing error handling"],
      patterns: ["Recurring login failures", "Redirect misconfiguration"],
      recommendedActions: ["Fix redirect logic", "Add integration tests"],
      confidence: 0.85,
    });

    const result = await analyzeRootCause(["a", "b"]);

    // DB queried with the provided ids.
    expect(feedbackItemFindMany).toHaveBeenCalledTimes(1);
    const call = feedbackItemFindMany.mock.calls[0][0] as {
      where: { id: { in: string[] } };
      include: { analysis: { select: Record<string, boolean> } };
    };
    expect(call.where.id.in).toEqual(["a", "b"]);
    expect(call.include.analysis.select).toEqual({
      sentiment: true,
      topics: true,
      summary: true,
    });

    // LLM called once with the system + user prompt.
    expect(chatJsonMock).toHaveBeenCalledTimes(1);
    const [systemPrompt, userPrompt] = chatJsonMock.mock.calls[0];
    expect(systemPrompt).toBe(
      "You are a senior engineering manager. Analyze these related customer feedback items and identify root causes. Return JSON with {rootCauses: string[], patterns: string[], recommendedActions: string[], confidence: number}"
    );
    const parsed = JSON.parse(userPrompt);
    expect(parsed.totalItems).toBe(2);
    expect(parsed.feedbackItems[0].sentiment).toBe("negative");

    // Result normalized.
    expect(result.rootCauses).toEqual([
      "Auth redirect loop",
      "Missing error handling",
    ]);
    expect(result.patterns).toHaveLength(2);
    expect(result.recommendedActions).toHaveLength(2);
    expect(result.confidence).toBe(0.85);
  });

  it("throws when no feedback items are found for the provided ids", async () => {
    feedbackItemFindMany.mockResolvedValue([] as never);

    await expect(analyzeRootCause(["missing"])).rejects.toThrow(/No feedback items found/);
    expect(chatJsonMock).not.toHaveBeenCalled();
  });

  it("propagates LLM errors", async () => {
    feedbackItemFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockRejectedValue(new Error("LLM down"));

    await expect(analyzeRootCause(["item-1"])).rejects.toThrow("LLM down");
  });

  it("normalizes missing/incorrect LLM fields defensively", async () => {
    feedbackItemFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue({
      rootCauses: "not an array",
      patterns: null,
      recommendedActions: ["Fix redirect logic"],
      confidence: "high",
    });

    const result = await analyzeRootCause(["item-1"]);

    expect(result.rootCauses).toEqual([]);
    expect(result.patterns).toEqual([]);
    expect(result.recommendedActions).toEqual(["Fix redirect logic"]);
    expect(result.confidence).toBe(0);
  });

  it("clamps confidence to the [0, 1] range", async () => {
    feedbackItemFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue({
      rootCauses: [],
      patterns: [],
      recommendedActions: [],
      confidence: 1.5,
    });

    const result = await analyzeRootCause(["item-1"]);
    expect(result.confidence).toBe(1);

    chatJsonMock.mockResolvedValueOnce({
      rootCauses: [],
      patterns: [],
      recommendedActions: [],
      confidence: -0.3,
    });
    const result2 = await analyzeRootCause(["item-1"]);
    expect(result2.confidence).toBe(0);
  });

  it("uses items without an analysis (null analysis) gracefully", async () => {
    feedbackItemFindMany.mockResolvedValue([
      makeItem({ analysis: null }),
    ] as never);

    chatJsonMock.mockResolvedValue({
      rootCauses: ["Unknown"],
      patterns: [],
      recommendedActions: [],
      confidence: 0.2,
    });

    const result = await analyzeRootCause(["item-1"]);
    expect(result.rootCauses).toEqual(["Unknown"]);

    const userPrompt = chatJsonMock.mock.calls[0][1];
    const parsed = JSON.parse(userPrompt);
    expect(parsed.feedbackItems[0].summary).toBeNull();
    expect(parsed.feedbackItems[0].sentiment).toBeNull();
    expect(parsed.feedbackItems[0].topics).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getRootCauseAnalysis
// ---------------------------------------------------------------------------

describe("getRootCauseAnalysis", () => {
  it("delegates to analyzeRootCause and returns its result", async () => {
    feedbackItemFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue({
      rootCauses: ["RC"],
      patterns: ["P"],
      recommendedActions: ["A"],
      confidence: 0.5,
    });

    const result = await getRootCauseAnalysis(["item-1"]);
    expect(result.rootCauses).toEqual(["RC"]);
    expect(result.confidence).toBe(0.5);
    expect(feedbackItemFindMany).toHaveBeenCalledTimes(1);
    expect(chatJsonMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache — repeated calls re-run the analysis", async () => {
    feedbackItemFindMany.mockResolvedValue([makeItem()] as never);
    chatJsonMock.mockResolvedValue({
      rootCauses: ["RC"],
      patterns: [],
      recommendedActions: [],
      confidence: 0.5,
    });

    await getRootCauseAnalysis(["item-1"]);
    await getRootCauseAnalysis(["item-1"]);

    // Both calls hit the DB and the LLM — no caching.
    expect(feedbackItemFindMany).toHaveBeenCalledTimes(2);
    expect(chatJsonMock).toHaveBeenCalledTimes(2);
  });
});
