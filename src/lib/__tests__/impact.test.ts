import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so getImpactForItem can be tested without a database.
const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: {
      findUnique: mockFindUnique,
    },
  },
}));

beforeEach(() => {
  mockFindUnique.mockReset();
});

import {
  calculateImpactScore,
  getImpactForItem,
} from "@/lib/impact";

describe("calculateImpactScore", () => {
  it("returns zero for all-zero inputs", () => {
    const result = calculateImpactScore({
      severityScore: 0,
      voteCount: 0,
      duplicateCount: 0,
      ageInDays: 0,
    });
    expect(result.score).toBe(0);
    expect(result.breakdown).toEqual({
      severity: 0,
      votes: 0,
      duplicates: 0,
      ageInDays: 0,
    });
  });

  it("computes the expected score for typical inputs", () => {
    // severity 3 -> 45, votes 4 -> 6, duplicates 2 -> 4 => 55
    const result = calculateImpactScore({
      severityScore: 3,
      voteCount: 4,
      duplicateCount: 2,
      ageInDays: 10,
    });
    expect(result.score).toBe(55);
    expect(result.breakdown.severity).toBe(45);
    expect(result.breakdown.votes).toBe(6);
    expect(result.breakdown.duplicates).toBe(4);
    expect(result.breakdown.ageInDays).toBe(10);
  });

  it("caps severity component at 75", () => {
    // severity 5 -> 75 (cap), severity 10 would be 150 -> capped to 75
    const result = calculateImpactScore({
      severityScore: 10,
      voteCount: 0,
      duplicateCount: 0,
      ageInDays: 0,
    });
    expect(result.breakdown.severity).toBe(75);
    expect(result.score).toBe(75);
  });

  it("caps vote component at 15 (10 votes)", () => {
    const result = calculateImpactScore({
      severityScore: 0,
      voteCount: 50,
      duplicateCount: 0,
      ageInDays: 0,
    });
    expect(result.breakdown.votes).toBe(15);
    expect(result.score).toBe(15);
  });

  it("caps duplicate component at 10 (5 duplicates)", () => {
    const result = calculateImpactScore({
      severityScore: 0,
      voteCount: 0,
      duplicateCount: 99,
      ageInDays: 0,
    });
    expect(result.breakdown.duplicates).toBe(10);
    expect(result.score).toBe(10);
  });

  it("reaches the maximum score of 100 with high severity + many votes + many duplicates", () => {
    const result = calculateImpactScore({
      severityScore: 5,
      voteCount: 100,
      duplicateCount: 20,
      ageInDays: 365,
    });
    expect(result.breakdown.severity).toBe(75);
    expect(result.breakdown.votes).toBe(15);
    expect(result.breakdown.duplicates).toBe(10);
    expect(result.score).toBe(100);
  });

  it("does not apply age decay (ageInDays does not affect score)", () => {
    const young = calculateImpactScore({
      severityScore: 3,
      voteCount: 4,
      duplicateCount: 2,
      ageInDays: 0,
    });
    const old = calculateImpactScore({
      severityScore: 3,
      voteCount: 4,
      duplicateCount: 2,
      ageInDays: 1000,
    });
    expect(young.score).toBe(old.score);
  });

  it("handles fractional vote contributions", () => {
    // 1 vote -> 1.5
    const result = calculateImpactScore({
      severityScore: 0,
      voteCount: 1,
      duplicateCount: 0,
      ageInDays: 0,
    });
    expect(result.breakdown.votes).toBe(1.5);
    expect(result.score).toBe(1.5);
  });
});

describe("getImpactForItem", () => {
  it("returns null when the feedback item does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getImpactForItem("missing");
    expect(result).toBeNull();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
  });

  it("uses severity 0 when no analysis exists", async () => {
    mockFindUnique.mockResolvedValue({
      id: "f1",
      originalTimestamp: new Date(),
      analysis: null,
      _count: { votes: 0, linksFrom: 0, linksTo: 0 },
    });

    const result = await getImpactForItem("f1");
    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.breakdown.severity).toBe(0);
  });

  it("aggregates votes and duplicate links from both directions", async () => {
    mockFindUnique.mockResolvedValue({
      id: "f1",
      originalTimestamp: new Date(),
      analysis: { severityScore: 4 },
      _count: { votes: 6, linksFrom: 2, linksTo: 1 },
    });

    const result = await getImpactForItem("f1");
    // severity 4 -> 60, votes 6 -> 9, duplicates 3 -> 6 => 75
    expect(result).not.toBeNull();
    expect(result!.breakdown.severity).toBe(60);
    expect(result!.breakdown.votes).toBe(9);
    expect(result!.breakdown.duplicates).toBe(6);
    expect(result!.score).toBe(75);
    expect(result!.breakdown.ageInDays).toBe(0);
  });

  it("computes ageInDays from originalTimestamp", async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    mockFindUnique.mockResolvedValue({
      id: "f1",
      originalTimestamp: tenDaysAgo,
      analysis: { severityScore: 1 },
      _count: { votes: 0, linksFrom: 0, linksTo: 0 },
    });

    const result = await getImpactForItem("f1");
    expect(result).not.toBeNull();
    expect(result!.breakdown.ageInDays).toBe(10);
    // severity 1 -> 15
    expect(result!.score).toBe(15);
  });

  it("passes the feedback item id to prisma.findUnique", async () => {
    mockFindUnique.mockResolvedValue({
      id: "f1",
      originalTimestamp: new Date(),
      analysis: { severityScore: 1 },
      _count: { votes: 0, linksFrom: 0, linksTo: 0 },
    });

    await getImpactForItem("f1");

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "f1" },
      select: expect.objectContaining({
        analysis: expect.any(Object),
        _count: expect.any(Object),
      }),
    });
  });
});
