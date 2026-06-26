import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the archive service can be tested without a database.
// vi.hoisted ensures the mock fns are initialized before the hoisted
// vi.mock factory runs.
const {
  mockCreate,
  mockDeleteMany,
  mockFindUnique,
  mockFindMany,
  mockCount,
  mockGroupBy,
} = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockGroupBy: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackArchive: {
      create: mockCreate,
      deleteMany: mockDeleteMany,
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      count: mockCount,
      groupBy: mockGroupBy,
    },
  },
}));

beforeEach(() => {
  mockCreate.mockReset();
  mockDeleteMany.mockReset();
  mockFindUnique.mockReset();
  mockFindMany.mockReset();
  mockCount.mockReset();
  mockGroupBy.mockReset();
});

import {
  archiveItem,
  unarchiveItem,
  isArchived,
  listArchived,
  getArchiveStats,
} from "@/lib/archive";

describe("Archive service", () => {
  describe("archiveItem", () => {
    it("creates a FeedbackArchive record when not already archived", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "arc-1",
        feedbackItemId: "f1",
        archivedById: "u1",
        reason: "resolved",
      });

      const result = await archiveItem("f1", "u1", "resolved");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { feedbackItemId: "f1" },
      });
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          feedbackItemId: "f1",
          archivedById: "u1",
          reason: "resolved",
        },
      });
      expect(result).toEqual({
        id: "arc-1",
        feedbackItemId: "f1",
        archivedById: "u1",
        reason: "resolved",
      });
    });

    it("throws if the item is already archived", async () => {
      mockFindUnique.mockResolvedValue({
        id: "arc-1",
        feedbackItemId: "f1",
      });

      await expect(archiveItem("f1", "u1")).rejects.toThrow(
        "Feedback item is already archived"
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("stores null reason when none is provided", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "arc-2",
        feedbackItemId: "f2",
        archivedById: "u1",
        reason: null,
      });

      await archiveItem("f2", "u1");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          feedbackItemId: "f2",
          archivedById: "u1",
          reason: null,
        },
      });
    });

    it("stores an empty-string reason as null", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "arc-3",
        feedbackItemId: "f3",
        archivedById: "u1",
        reason: null,
      });

      await archiveItem("f3", "u1", "");

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          feedbackItemId: "f3",
          archivedById: "u1",
          reason: null,
        },
      });
    });
  });

  describe("unarchiveItem", () => {
    it("deletes the archive record by feedbackItemId", async () => {
      mockDeleteMany.mockResolvedValue({ count: 1 });

      await unarchiveItem("f1");

      expect(mockDeleteMany).toHaveBeenCalledTimes(1);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { feedbackItemId: "f1" },
      });
    });

    it("is a no-op when the item is not archived", async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });

      await unarchiveItem("f-missing");

      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { feedbackItemId: "f-missing" },
      });
    });
  });

  describe("isArchived", () => {
    it("returns true when an archive record exists", async () => {
      mockFindUnique.mockResolvedValue({ id: "arc-1" });

      const result = await isArchived("f1");

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { feedbackItemId: "f1" },
        select: { id: true },
      });
      expect(result).toBe(true);
    });

    it("returns false when no archive record exists", async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await isArchived("f-missing");

      expect(result).toBe(false);
    });
  });

  describe("listArchived", () => {
    it("returns paginated archived items newest-first with feedback details", async () => {
      const items = [
        {
          id: "arc-2",
          feedbackItemId: "f2",
          reason: "irrelevant",
          createdAt: new Date("2024-01-02T00:00:00Z"),
          feedbackItem: {
            id: "f2",
            source: "GitHubIssues",
            externalId: "ext-2",
            title: "Second",
            rawContent: "content-2",
          },
          archivedBy: { id: "u1", name: "Alice", email: "a@x.com" },
        },
        {
          id: "arc-1",
          feedbackItemId: "f1",
          reason: "resolved",
          createdAt: new Date("2024-01-01T00:00:00Z"),
          feedbackItem: {
            id: "f1",
            source: "Trustpilot",
            externalId: "ext-1",
            title: "First",
            rawContent: "content-1",
          },
          archivedBy: { id: "u1", name: "Alice", email: "a@x.com" },
        },
      ];
      mockFindMany.mockResolvedValue(items);
      mockCount.mockResolvedValue(42);

      const result = await listArchived(1, 20);

      expect(mockFindMany).toHaveBeenCalledWith({
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        include: {
          feedbackItem: {
            select: {
              id: true,
              source: true,
              externalId: true,
              title: true,
              rawContent: true,
            },
          },
          archivedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
      expect(result).toEqual({ items, total: 42, page: 1, pageSize: 20 });
    });

    it("computes skip from page and pageSize", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await listArchived(3, 10);

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });

    it("defaults to page 1 with pageSize 20", async () => {
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await listArchived();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
    });
  });

  describe("getArchiveStats", () => {
    it("returns totals and a by-reason breakdown", async () => {
      mockCount
        .mockResolvedValueOnce(50) // totalArchived
        .mockResolvedValueOnce(7); // archivedThisWeek
      mockGroupBy.mockResolvedValue([
        { reason: "resolved", _count: { _all: 30 } },
        { reason: "irrelevant", _count: { _all: 15 } },
        { reason: null, _count: { _all: 5 } },
      ]);

      const stats = await getArchiveStats();

      expect(stats.totalArchived).toBe(50);
      expect(stats.archivedThisWeek).toBe(7);
      expect(stats.byReason).toEqual({
        resolved: 30,
        irrelevant: 15,
        none: 5,
      });
    });

    it("counts archives created since the start of the week", async () => {
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);

      await getArchiveStats();

      // Second count call filters by createdAt >= start of week.
      const weekCall = mockCount.mock.calls[1][0];
      expect(weekCall).toHaveProperty("where");
      expect(weekCall.where).toHaveProperty("createdAt");
      expect(weekCall.where.createdAt).toHaveProperty("gte");
      const gte: Date = weekCall.where.createdAt.gte;
      // The "start of week" should be at or before now and within the
      // last 7 days.
      expect(gte.getTime()).toBeLessThanOrEqual(Date.now());
      expect(gte.getTime()).toBeGreaterThanOrEqual(Date.now() - 7 * 24 * 60 * 60 * 1000);
    });

    it("returns an empty byReason map when there are no archives", async () => {
      mockCount.mockResolvedValue(0);
      mockGroupBy.mockResolvedValue([]);

      const stats = await getArchiveStats();

      expect(stats.byReason).toEqual({});
      expect(stats.totalArchived).toBe(0);
      expect(stats.archivedThisWeek).toBe(0);
    });
  });
});
