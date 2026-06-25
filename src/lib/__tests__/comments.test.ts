import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock feedbackComment model we control from each test.
// vi.hoisted ensures the mock object exists before the hoisted vi.mock call.
const { mockFeedbackComment } = vi.hoisted(() => ({
  mockFeedbackComment: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackComment: mockFeedbackComment,
  },
}));

import { listComments, createComment } from "@/lib/comments";

beforeEach(() => {
  mockFeedbackComment.findMany.mockReset();
  mockFeedbackComment.create.mockReset();
});

describe("comments service", () => {
  describe("listComments", () => {
    it("queries by feedbackItemId, orders by createdAt asc, includes author", async () => {
      const created1 = new Date("2024-01-01T00:00:00.000Z");
      const created2 = new Date("2024-01-02T00:00:00.000Z");
      mockFeedbackComment.findMany.mockResolvedValue([
        {
          id: "c1",
          body: "First note",
          createdAt: created1,
          author: { id: "u1", name: "Alice", email: "alice@example.com" },
        },
        {
          id: "c2",
          body: "Second note",
          createdAt: created2,
          author: { id: "u2", name: null, email: "bob@example.com" },
        },
      ]);

      const comments = await listComments("fi-1");

      expect(mockFeedbackComment.findMany).toHaveBeenCalledWith({
        where: { feedbackItemId: "fi-1" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });
      expect(comments).toEqual([
        {
          id: "c1",
          body: "First note",
          createdAt: created1.toISOString(),
          author: { id: "u1", name: "Alice", email: "alice@example.com" },
        },
        {
          id: "c2",
          body: "Second note",
          createdAt: created2.toISOString(),
          author: { id: "u2", name: null, email: "bob@example.com" },
        },
      ]);
    });

    it("returns an empty array when there are no comments", async () => {
      mockFeedbackComment.findMany.mockResolvedValue([]);
      const comments = await listComments("fi-empty");
      expect(comments).toEqual([]);
    });

    it("converts Date objects to ISO strings in the output", async () => {
      const created = new Date("2024-03-15T12:30:45.123Z");
      mockFeedbackComment.findMany.mockResolvedValue([
        {
          id: "c1",
          body: "note",
          createdAt: created,
          author: { id: "u1", name: "Alice", email: "alice@example.com" },
        },
      ]);

      const comments = await listComments("fi-1");
      expect(typeof comments[0].createdAt).toBe("string");
      expect(comments[0].createdAt).toBe(created.toISOString());
    });
  });

  describe("createComment", () => {
    it("calls prisma.feedbackComment.create with the correct data", async () => {
      const created = new Date("2024-02-01T10:00:00.000Z");
      mockFeedbackComment.create.mockResolvedValue({
        id: "c9",
        body: "New note",
        createdAt: created,
        author: { id: "u1", name: "Alice", email: "alice@example.com" },
      });

      const comment = await createComment("fi-1", "u1", "New note");

      expect(mockFeedbackComment.create).toHaveBeenCalledWith({
        data: { feedbackItemId: "fi-1", authorId: "u1", body: "New note" },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      });
      expect(comment).toEqual({
        id: "c9",
        body: "New note",
        createdAt: created.toISOString(),
        author: { id: "u1", name: "Alice", email: "alice@example.com" },
      });
    });

    it("converts the created Date object to an ISO string in the output", async () => {
      const created = new Date("2024-05-20T08:15:30.000Z");
      mockFeedbackComment.create.mockResolvedValue({
        id: "c9",
        body: "note",
        createdAt: created,
        author: { id: "u1", name: "Alice", email: "alice@example.com" },
      });

      const comment = await createComment("fi-1", "u1", "note");
      expect(typeof comment.createdAt).toBe("string");
      expect(comment.createdAt).toBe(created.toISOString());
    });
  });
});
