import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock prisma before importing the service.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      updateMany: vi.fn(),
    },
    feedbackLabel: {
      upsert: vi.fn(),
    },
    feedbackItem: {
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { executeBulk } from "@/lib/bulk";

const mockedPrisma = prisma as unknown as {
  feedbackAnalysis: { updateMany: ReturnType<typeof vi.fn> };
  feedbackLabel: { upsert: ReturnType<typeof vi.fn> };
  feedbackItem: { deleteMany: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeBulk", () => {
  it("status action calls feedbackAnalysis.updateMany with correct data per id", async () => {
    mockedPrisma.feedbackAnalysis.updateMany.mockResolvedValue({ count: 1 });

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "status",
      value: "ACKNOWLEDGED",
    });

    expect(mockedPrisma.feedbackAnalysis.updateMany).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.feedbackAnalysis.updateMany).toHaveBeenCalledWith({
      where: { feedbackItemId: "a" },
      data: { status: "ACKNOWLEDGED" },
    });
    expect(mockedPrisma.feedbackAnalysis.updateMany).toHaveBeenCalledWith({
      where: { feedbackItemId: "b" },
      data: { status: "ACKNOWLEDGED" },
    });
    expect(result.affected).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("delete action calls feedbackItem.deleteMany with all ids", async () => {
    mockedPrisma.feedbackItem.deleteMany.mockResolvedValue({ count: 2 });

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "delete",
      value: "",
    });

    expect(mockedPrisma.feedbackItem.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.feedbackItem.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["a", "b"] } },
    });
    expect(result.affected).toBe(2);
    expect(result.errors).toEqual([]);
  });

  it("collects per-item errors for status action", async () => {
    mockedPrisma.feedbackAnalysis.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockRejectedValueOnce(new Error("boom"));

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "status",
      value: "NEW",
    });

    expect(result.affected).toBe(1);
    expect(result.errors).toEqual([{ id: "b", error: "boom" }]);
  });

  it("label action upserts a feedbackLabel per id", async () => {
    mockedPrisma.feedbackLabel.upsert.mockResolvedValue({});

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "label",
      value: "bug",
    });

    expect(mockedPrisma.feedbackLabel.upsert).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.feedbackLabel.upsert).toHaveBeenCalledWith({
      where: {
        feedbackItemId_labelId: { feedbackItemId: "a", labelId: "bug" },
      },
      create: { feedbackItemId: "a", labelId: "bug" },
      update: {},
    });
    expect(result.affected).toBe(2);
  });

  it("assign action calls updateMany once with null when value empty", async () => {
    mockedPrisma.feedbackAnalysis.updateMany.mockResolvedValue({ count: 2 });

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "assign",
      value: "",
    });

    expect(mockedPrisma.feedbackAnalysis.updateMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.feedbackAnalysis.updateMany).toHaveBeenCalledWith({
      where: { feedbackItemId: { in: ["a", "b"] } },
      data: { assignedToId: null },
    });
    expect(result.affected).toBe(2);
  });
});

// API-level zod validation (mirrors the route schema).
const BulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(["status", "assign", "label", "delete"]),
  value: z.string(),
});

describe("bulk zod schema", () => {
  it("rejects an empty ids array", () => {
    const parsed = BulkSchema.safeParse({
      ids: [],
      action: "status",
      value: "NEW",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects more than 500 ids", () => {
    const parsed = BulkSchema.safeParse({
      ids: Array.from({ length: 501 }, (_, i) => String(i)),
      action: "delete",
      value: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an invalid action", () => {
    const parsed = BulkSchema.safeParse({
      ids: ["a"],
      action: "bogus",
      value: "",
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a valid request", () => {
    const parsed = BulkSchema.safeParse({
      ids: ["a", "b"],
      action: "status",
      value: "NEW",
    });
    expect(parsed.success).toBe(true);
  });
});
