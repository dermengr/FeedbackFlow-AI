import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the service.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { searchFeedback } from "@/lib/search";

const mockedPrisma = prisma as unknown as {
  $queryRaw: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchFeedback", () => {
  it("returns empty results without hitting the DB for an empty query", async () => {
    const result = await searchFeedback("", 1, 20);

    expect(result).toEqual({ results: [], total: 0 });
    expect(mockedPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns empty results for a whitespace-only query without hitting the DB", async () => {
    const result = await searchFeedback("   ", 1, 20);

    expect(result).toEqual({ results: [], total: 0 });
    expect(mockedPrisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("calls $queryRaw for a non-empty query and maps snake_case rows to camelCase", async () => {
    // First call returns the search rows, second call returns the count.
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "item-1",
          title: "Login broken",
          rawContent: "I cannot log in with Google",
          externalId: "github#123",
          url: "https://example.com/123",
          sentiment: "negative",
          summary: "User reports login failure",
          ts_rank: 0.5,
        },
        {
          id: "item-2",
          title: null,
          rawContent: "login button missing",
          externalId: "reddit#9",
          url: null,
          sentiment: null,
          summary: null,
          ts_rank: 0.1,
        },
      ])
      .mockResolvedValueOnce([{ count: BigInt(2) }]);

    const result = await searchFeedback("login", 1, 20);

    expect(mockedPrisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(result.total).toBe(2);
    expect(result.results).toHaveLength(2);
    expect(result.results[0]).toEqual({
      id: "item-1",
      title: "Login broken",
      rawContent: "I cannot log in with Google",
      externalId: "github#123",
      url: "https://example.com/123",
      sentiment: "negative",
      summary: "User reports login failure",
      tsRank: 0.5,
    });
    expect(result.results[1]).toEqual({
      id: "item-2",
      title: null,
      rawContent: "login button missing",
      externalId: "reddit#9",
      url: null,
      sentiment: null,
      summary: null,
      tsRank: 0.1,
    });
  });

  it("coerces bigint count and ts_rank to numbers", async () => {
    mockedPrisma.$queryRaw
      .mockResolvedValueOnce([
        {
          id: "x",
          title: "t",
          rawContent: "c",
          externalId: "e",
          url: null,
          sentiment: "neutral",
          summary: "s",
          ts_rank: BigInt(0),
        },
      ])
      .mockResolvedValueOnce([{ count: BigInt(7) }]);

    const result = await searchFeedback("t", 2, 5);

    expect(result.total).toBe(7);
    expect(typeof result.total).toBe("number");
    expect(result.results[0].tsRank).toBe(0);
    expect(typeof result.results[0].tsRank).toBe("number");
  });

  it("defaults to total 0 when count query returns no rows", async () => {
    mockedPrisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await searchFeedback("something", 1, 10);

    expect(result.total).toBe(0);
    expect(result.results).toEqual([]);
  });
});
