import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the suggestion service can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    searchHistory: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  getSuggestions,
  recordSearch,
  getRecentSearches,
} from "@/lib/search-suggestions";

const mockedPrisma = prisma as unknown as {
  searchHistory: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  feedbackAnalysis: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSuggestions", () => {
  it("returns popular topics and skips history for an empty partial", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([
      { topics: ["Bug Report", "Performance"] },
      { topics: ["Bug Report", "Pricing"] },
      { topics: ["Performance"] },
    ]);

    const res = await getSuggestions("user-1", "   ");

    expect(mockedPrisma.searchHistory.findMany).not.toHaveBeenCalled();
    expect(mockedPrisma.feedbackAnalysis.findMany).toHaveBeenCalledTimes(1);
    // history is empty for empty partial; popular ranked by frequency.
    expect(res.history).toEqual([]);
    expect(res.popular).toEqual(["Bug Report", "Performance", "Pricing"]);
    // combined mirrors history + popular with no dupes.
    expect(res.combined).toEqual(["Bug Report", "Performance", "Pricing"]);
  });

  it("matches history by substring (case-insensitive) and orders by recency", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "login bug" },
      { query: "Login Page" },
      { query: "LOGIN" },
    ]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([]);

    const res = await getSuggestions("user-1", "log");

    expect(mockedPrisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-1",
          query: expect.objectContaining({ contains: "log", mode: "insensitive" }),
        }),
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    );
    // De-dup case-insensitively, preserving recency order.
    expect(res.history).toEqual(["login bug", "Login Page", "LOGIN"]);
    expect(res.popular).toEqual([]);
  });

  it("de-dups history case-insensitively", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "Login" },
      { query: "login" },
      { query: "LOGIN" },
    ]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([]);

    const res = await getSuggestions("user-1", "log");

    expect(res.history).toEqual(["Login"]);
  });

  it("ranks popular topics by frequency and limits to 5", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([
      { topics: ["A", "B", "C", "D", "E", "F"] },
      { topics: ["A", "A", "B"] },
      { topics: ["A", "C"] },
      { topics: ["F", "F", "F", "F"] },
    ]);

    const res = await getSuggestions("user-1", "x");

    // F:5, A:4, B:2, C:2, D:1, E:1
    // Top 5: F, A, B, C, D (B before C on alphabetical tie-break)
    expect(res.popular).toEqual(["F", "A", "B", "C", "D"]);
    expect(res.popular).toHaveLength(5);
  });

  it("combines history and popular with case-insensitive de-dup", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "Bug Report" },
    ]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([
      { topics: ["bug report", "Performance"] },
    ]);

    const res = await getSuggestions("user-1", "bug");

    expect(res.history).toEqual(["Bug Report"]);
    expect(res.popular).toEqual(["bug report", "Performance"]);
    // "Bug Report" and "bug report" are the same key -> only the first wins.
    expect(res.combined).toEqual(["Bug Report", "Performance"]);
  });

  it("ignores non-array / non-string topics defensively", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([]);
    mockedPrisma.feedbackAnalysis.findMany.mockResolvedValue([
      { topics: "not-an-array" },
      { topics: [123, "Valid", null, { x: 1 }, "  ", "Valid"] },
    ]);

    const res = await getSuggestions("user-1", "");

    expect(res.popular).toEqual(["Valid"]);
  });
});

describe("recordSearch", () => {
  it("creates a SearchHistory row with the trimmed query and count", async () => {
    mockedPrisma.searchHistory.create.mockResolvedValue({});

    await recordSearch("user-1", "  login bug  ", 7);

    expect(mockedPrisma.searchHistory.create).toHaveBeenCalledWith({
      data: { userId: "user-1", query: "login bug", resultsCount: 7 },
    });
  });

  it("defaults resultsCount to 0 when omitted", async () => {
    mockedPrisma.searchHistory.create.mockResolvedValue({});

    await recordSearch("user-1", "pricing");

    expect(mockedPrisma.searchHistory.create).toHaveBeenCalledWith({
      data: { userId: "user-1", query: "pricing", resultsCount: 0 },
    });
  });

  it("does nothing for an empty/whitespace query", async () => {
    await recordSearch("user-1", "   ");
    expect(mockedPrisma.searchHistory.create).not.toHaveBeenCalled();
  });

  it("floors negative / non-integer counts to 0", async () => {
    mockedPrisma.searchHistory.create.mockResolvedValue({});

    await recordSearch("user-1", "x", -3);

    expect(mockedPrisma.searchHistory.create).toHaveBeenCalledWith({
      data: { userId: "user-1", query: "x", resultsCount: 0 },
    });
  });
});

describe("getRecentSearches", () => {
  it("returns recent unique searches most-recent first, capped at limit", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "login" },
      { query: "pricing" },
      { query: "Login" },
      { query: "bug" },
      { query: "performance" },
    ]);

    const res = await getRecentSearches("user-1", 3);

    expect(mockedPrisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
        select: { query: true },
      })
    );
    // "Login" is a case-insensitive dup of "login" -> dropped.
    expect(res).toEqual(["login", "pricing", "bug"]);
  });

  it("de-dups case-insensitively", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "Login" },
      { query: "login" },
      { query: "LOGIN" },
    ]);

    const res = await getRecentSearches("user-1", 10);

    expect(res).toEqual(["Login"]);
  });

  it("returns an empty array when there is no history", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([]);

    const res = await getRecentSearches("user-1", 5);

    expect(res).toEqual([]);
  });

  it("clamps an invalid limit to at least 1", async () => {
    mockedPrisma.searchHistory.findMany.mockResolvedValue([
      { query: "only" },
    ]);

    const res = await getRecentSearches("user-1", 0);

    expect(res).toEqual(["only"]);
    // take is derived from the clamped limit (1 * 4 = 4).
    expect(mockedPrisma.searchHistory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 4 })
    );
  });
});
