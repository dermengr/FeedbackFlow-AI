import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the views service can be tested without a database. The mock
// functions are created via vi.hoisted so they are available inside the hoisted
// vi.mock factory.
const { mockFindMany, mockCreate, mockFindUnique, mockDelete } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    savedView: {
      findMany: mockFindMany,
      create: mockCreate,
      findUnique: mockFindUnique,
      delete: mockDelete,
    },
  },
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockCreate.mockReset();
  mockFindUnique.mockReset();
  mockDelete.mockReset();
});

import { listViews, createView, deleteView } from "@/lib/views";

describe("Saved views service", () => {
  describe("listViews", () => {
    it("filters by ownerId and orders by createdAt desc", async () => {
      const date1 = new Date("2026-01-01T00:00:00Z");
      const date2 = new Date("2026-02-01T00:00:00Z");
      mockFindMany.mockResolvedValue([
        { id: "v2", name: "Bugs", query: "topic=Bug", createdAt: date2 },
        { id: "v1", name: "Neg", query: "sentiment=negative", createdAt: date1 },
      ]);

      const result = await listViews("user-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { ownerId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      // newest first
      expect(result[0].id).toBe("v2");
      expect(result[1].id).toBe("v1");
    });

    it("converts createdAt Date to ISO string in DTOs", async () => {
      const date = new Date("2026-03-15T12:30:00Z");
      mockFindMany.mockResolvedValue([
        { id: "v9", name: "X", query: "a=b", createdAt: date },
      ]);

      const result = await listViews("user-1");
      expect(result[0].createdAt).toBe(date.toISOString());
      expect(typeof result[0].createdAt).toBe("string");
    });

    it("returns empty array when no views exist", async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await listViews("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("createView", () => {
    it("calls prisma.savedView.create with correct data", async () => {
      const date = new Date("2026-04-01T00:00:00Z");
      mockCreate.mockResolvedValue({
        id: "new-1",
        name: "My View",
        query: "sentiment=negative&topic=Bug",
        createdAt: date,
      });

      const result = await createView(
        "user-1",
        "My View",
        "sentiment=negative&topic=Bug"
      );

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          ownerId: "user-1",
          name: "My View",
          query: "sentiment=negative&topic=Bug",
        },
      });
      expect(result).toEqual({
        id: "new-1",
        name: "My View",
        query: "sentiment=negative&topic=Bug",
        createdAt: date.toISOString(),
      });
    });

    it("converts createdAt Date to ISO string", async () => {
      const date = new Date("2026-05-20T08:00:00Z");
      mockCreate.mockResolvedValue({
        id: "x",
        name: "n",
        query: "q",
        createdAt: date,
      });
      const result = await createView("u", "n", "q");
      expect(result.createdAt).toBe(date.toISOString());
    });
  });

  describe("deleteView", () => {
    it("verifies ownership before deleting", async () => {
      mockFindUnique.mockResolvedValue({
        id: "v1",
        ownerId: "user-1",
        name: "X",
        query: "q",
        createdAt: new Date(),
      });
      mockDelete.mockResolvedValue(undefined);

      await deleteView("v1", "user-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "v1" } });
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "v1" } });
    });

    it("throws if the view does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(deleteView("missing", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("throws if the view is owned by a different user", async () => {
      mockFindUnique.mockResolvedValue({
        id: "v1",
        ownerId: "user-2",
        name: "X",
        query: "q",
        createdAt: new Date(),
      });
      await expect(deleteView("v1", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });
});
