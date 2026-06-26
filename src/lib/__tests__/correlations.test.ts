import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so getTopicCorrelations can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      findMany: vi.fn(),
    },
  },
}));

import {
  buildCoOccurrenceMatrix,
  strengthForCount,
  getTopicCorrelations,
} from "@/lib/correlations";
import { prisma } from "@/lib/prisma";

describe("buildCoOccurrenceMatrix", () => {
  it("counts each unordered pair once per analysis", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["bug", "ui"],
      ["bug", "ui"],
      ["bug", "performance"],
    ]);
    expect(matrix.get("bug|ui")).toBe(2);
    expect(matrix.get("bug|performance")).toBe(1);
    expect(matrix.size).toBe(2);
  });

  it("uses a canonical alphabetical key regardless of input order", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["ui", "bug"],
      ["bug", "ui"],
    ]);
    // Both orderings collapse to the same canonical "bug|ui" key.
    expect(matrix.get("bug|ui")).toBe(2);
    expect(matrix.has("ui|bug")).toBe(false);
  });

  it("counts all pairs within analyses containing more than two topics", () => {
    const matrix = buildCoOccurrenceMatrix([["bug", "ui", "performance"]]);
    expect(matrix.get("bug|performance")).toBe(1);
    expect(matrix.get("bug|ui")).toBe(1);
    expect(matrix.get("performance|ui")).toBe(1);
    expect(matrix.size).toBe(3);
  });

  it("excludes self-pairs (a topic never co-occurs with itself)", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["bug", "bug", "bug"],
      ["bug", "bug", "ui"],
    ]);
    // "bug|bug" is never a key.
    expect(matrix.has("bug|bug")).toBe(false);
    // The repeated bug in the second analysis still only counts bug|ui once.
    expect(matrix.get("bug|ui")).toBe(1);
  });

  it("de-duplicates topics within a single analysis", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["bug", "bug", "ui", "ui"],
      ["bug", "ui"],
    ]);
    // Each analysis contributes at most one to a given pair.
    expect(matrix.get("bug|ui")).toBe(2);
  });

  it("handles empty input", () => {
    const matrix = buildCoOccurrenceMatrix([]);
    expect(matrix.size).toBe(0);
  });

  it("handles arrays of empty arrays", () => {
    const matrix = buildCoOccurrenceMatrix([[], [], []]);
    expect(matrix.size).toBe(0);
  });

  it("handles analyses with a single topic (no pairs)", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["solo"],
      ["solo"],
      ["solo"],
    ]);
    // A single topic can never form a pair.
    expect(matrix.size).toBe(0);
  });

  it("ignores non-string entries within topic arrays", () => {
    const matrix = buildCoOccurrenceMatrix([
      ["bug", 123, null, "ui"] as unknown as string[],
    ]);
    // Only the two string topics form a pair.
    expect(matrix.get("bug|ui")).toBe(1);
    expect(matrix.size).toBe(1);
  });
});

describe("strengthForCount", () => {
  it("classifies counts above 20 as strong", () => {
    expect(strengthForCount(21)).toBe("strong");
    expect(strengthForCount(100)).toBe("strong");
  });

  it("classifies counts above 10 (and <= 20) as moderate", () => {
    expect(strengthForCount(11)).toBe("moderate");
    expect(strengthForCount(20)).toBe("moderate");
  });

  it("classifies counts <= 10 as weak", () => {
    expect(strengthForCount(10)).toBe("weak");
    expect(strengthForCount(1)).toBe("weak");
    expect(strengthForCount(0)).toBe("weak");
  });
});

describe("getTopicCorrelations", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockReset();
  });

  it("builds correlations from fetched analyses and sorts by count desc", async () => {
    // Construct a dataset where bug|ui co-occurs most often.
    const topics: string[][] = [];
    for (let i = 0; i < 25; i++) topics.push(["bug", "ui"]);
    for (let i = 0; i < 15; i++) topics.push(["bug", "performance"]);
    for (let i = 0; i < 5; i++) topics.push(["ui", "performance"]);

    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue(
      topics.map((t) => ({ topics: t })) as never[]
    );

    const correlations = await getTopicCorrelations(30);
    expect(correlations).toHaveLength(3);

    // Sorted by count descending.
    expect(correlations[0]).toMatchObject({
      topicA: "bug",
      topicB: "ui",
      count: 25,
      strength: "strong",
    });
    expect(correlations[1]).toMatchObject({
      topicA: "bug",
      topicB: "performance",
      count: 15,
      strength: "moderate",
    });
    expect(correlations[2]).toMatchObject({
      topicA: "performance",
      topicB: "ui",
      count: 5,
      strength: "weak",
    });
  });

  it("returns an empty array when there are no analyses", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([]);
    const correlations = await getTopicCorrelations(30);
    expect(correlations).toEqual([]);
  });

  it("returns an empty array when analyses have no co-occurring topics", async () => {
    vi.mocked(prisma.feedbackAnalysis.findMany).mockResolvedValue([
      { topics: ["solo"] },
      { topics: [] },
      { topics: ["alone"] },
    ] as never[]);
    const correlations = await getTopicCorrelations(30);
    expect(correlations).toEqual([]);
  });
});
