import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock feedbackVote model we control from each test.
// vi.hoisted ensures the mock object exists before the hoisted vi.mock call.
const { mockFeedbackVote } = vi.hoisted(() => ({
  mockFeedbackVote: {
    upsert: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackVote: mockFeedbackVote,
  },
}));

import {
  castVote,
  removeVote,
  getVoteSummary,
  getBatchVoteSummaries,
} from "@/lib/voting";

beforeEach(() => {
  mockFeedbackVote.upsert.mockReset();
  mockFeedbackVote.delete.mockReset();
  mockFeedbackVote.groupBy.mockReset();
  mockFeedbackVote.findMany.mockReset();
});

describe("voting service", () => {
  describe("castVote", () => {
    it("upserts a vote keyed on [feedbackItemId, userId, type]", async () => {
      const created = {
        id: "v1",
        feedbackItemId: "fi-1",
        userId: "u1",
        type: "up",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      mockFeedbackVote.upsert.mockResolvedValue(created);

      const result = await castVote("fi-1", "u1", "up");

      expect(mockFeedbackVote.upsert).toHaveBeenCalledWith({
        where: {
          feedbackItemId_userId_type: {
            feedbackItemId: "fi-1",
            userId: "u1",
            type: "up",
          },
        },
        update: {},
        create: { feedbackItemId: "fi-1", userId: "u1", type: "up" },
      });
      expect(result).toEqual(created);
    });

    it("is idempotent: re-casting the same vote performs an upsert with an empty update", async () => {
      const existing = {
        id: "v1",
        feedbackItemId: "fi-1",
        userId: "u1",
        type: "up",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      mockFeedbackVote.upsert.mockResolvedValue(existing);

      await castVote("fi-1", "u1", "up");

      expect(mockFeedbackVote.upsert).toHaveBeenCalledTimes(1);
      const args = mockFeedbackVote.upsert.mock.calls[0][0];
      // On a duplicate, no fields are changed — the update is empty.
      expect(args.update).toEqual({});
      expect(args.create).toEqual({
        feedbackItemId: "fi-1",
        userId: "u1",
        type: "up",
      });
    });

    it("supports each vote type", async () => {
      mockFeedbackVote.upsert.mockResolvedValue({});
      await castVote("fi-1", "u1", "down");
      await castVote("fi-1", "u1", "heart");

      expect(mockFeedbackVote.upsert).toHaveBeenCalledTimes(2);
      expect(mockFeedbackVote.upsert.mock.calls[0][0].create.type).toBe("down");
      expect(mockFeedbackVote.upsert.mock.calls[1][0].create.type).toBe("heart");
    });
  });

  describe("removeVote", () => {
    it("deletes the vote keyed on [feedbackItemId, userId, type]", async () => {
      const deleted = {
        id: "v1",
        feedbackItemId: "fi-1",
        userId: "u1",
        type: "up",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
      };
      mockFeedbackVote.delete.mockResolvedValue(deleted);

      const result = await removeVote("fi-1", "u1", "up");

      expect(mockFeedbackVote.delete).toHaveBeenCalledWith({
        where: {
          feedbackItemId_userId_type: {
            feedbackItemId: "fi-1",
            userId: "u1",
            type: "up",
          },
        },
      });
      expect(result).toEqual(deleted);
    });

    it("returns null when the vote does not exist (P2025 swallowed)", async () => {
      mockFeedbackVote.delete.mockRejectedValue(
        new Error("Record to delete does not exist.")
      );

      const result = await removeVote("fi-1", "u1", "up");
      expect(result).toBeNull();
    });
  });

  describe("getVoteSummary", () => {
    it("aggregates per-type counts and includes the current user's votes", async () => {
      mockFeedbackVote.groupBy.mockResolvedValue([
        { type: "up", _count: { _all: 3 } },
        { type: "down", _count: { _all: 1 } },
        { type: "heart", _count: { _all: 2 } },
      ]);
      mockFeedbackVote.findMany.mockResolvedValue([
        { type: "up" },
        { type: "heart" },
      ]);

      const summary = await getVoteSummary("fi-1", "u1");

      expect(mockFeedbackVote.groupBy).toHaveBeenCalledWith({
        by: ["type"],
        where: { feedbackItemId: "fi-1" },
        _count: { _all: true },
      });
      expect(mockFeedbackVote.findMany).toHaveBeenCalledWith({
        where: { feedbackItemId: "fi-1", userId: "u1" },
        select: { type: true },
      });
      expect(summary).toEqual({
        up: 3,
        down: 1,
        heart: 2,
        total: 6,
        userVotes: ["up", "heart"],
      });
    });

    it("returns zeroed counts and empty userVotes when there are no votes", async () => {
      mockFeedbackVote.groupBy.mockResolvedValue([]);
      mockFeedbackVote.findMany.mockResolvedValue([]);

      const summary = await getVoteSummary("fi-empty", "u1");

      expect(summary).toEqual({
        up: 0,
        down: 0,
        heart: 0,
        total: 0,
        userVotes: [],
      });
    });

    it("omits the user-votes query when no userId is provided", async () => {
      mockFeedbackVote.groupBy.mockResolvedValue([
        { type: "up", _count: { _all: 5 } },
      ]);

      const summary = await getVoteSummary("fi-1");

      expect(mockFeedbackVote.findMany).not.toHaveBeenCalled();
      expect(summary).toEqual({
        up: 5,
        down: 0,
        heart: 0,
        total: 5,
        userVotes: [],
      });
    });
  });

  describe("getBatchVoteSummaries", () => {
    it("returns a summary keyed by each requested id, aggregating counts and user votes", async () => {
      mockFeedbackVote.groupBy.mockResolvedValue([
        { feedbackItemId: "fi-1", type: "up", _count: { _all: 2 } },
        { feedbackItemId: "fi-1", type: "heart", _count: { _all: 1 } },
        { feedbackItemId: "fi-2", type: "down", _count: { _all: 4 } },
      ]);
      mockFeedbackVote.findMany.mockResolvedValue([
        { feedbackItemId: "fi-1", type: "up" },
        { feedbackItemId: "fi-2", type: "down" },
      ]);

      const summaries = await getBatchVoteSummaries(["fi-1", "fi-2"], "u1");

      expect(mockFeedbackVote.groupBy).toHaveBeenCalledWith({
        by: ["feedbackItemId", "type"],
        where: { feedbackItemId: { in: ["fi-1", "fi-2"] } },
        _count: { _all: true },
      });
      expect(mockFeedbackVote.findMany).toHaveBeenCalledWith({
        where: { feedbackItemId: { in: ["fi-1", "fi-2"] }, userId: "u1" },
        select: { feedbackItemId: true, type: true },
      });

      expect(summaries["fi-1"]).toEqual({
        up: 2,
        down: 0,
        heart: 1,
        total: 3,
        userVotes: ["up"],
      });
      expect(summaries["fi-2"]).toEqual({
        up: 0,
        down: 4,
        heart: 0,
        total: 4,
        userVotes: ["down"],
      });
    });

    it("returns zeroed summaries for items with no votes", async () => {
      mockFeedbackVote.groupBy.mockResolvedValue([]);
      mockFeedbackVote.findMany.mockResolvedValue([]);

      const summaries = await getBatchVoteSummaries(["fi-a", "fi-b"], "u1");

      expect(summaries["fi-a"]).toEqual({
        up: 0,
        down: 0,
        heart: 0,
        total: 0,
        userVotes: [],
      });
      expect(summaries["fi-b"]).toEqual({
        up: 0,
        down: 0,
        heart: 0,
        total: 0,
        userVotes: [],
      });
    });

    it("returns an empty object when given no ids", async () => {
      const summaries = await getBatchVoteSummaries([], "u1");
      expect(summaries).toEqual({});
      expect(mockFeedbackVote.groupBy).not.toHaveBeenCalled();
      expect(mockFeedbackVote.findMany).not.toHaveBeenCalled();
    });
  });
});
