import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock prisma before importing the service.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackAnalysis: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    feedbackLabel: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    feedbackItem: {
      deleteMany: vi.fn(),
    },
    feedbackArchive: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { executeBulk } from "@/lib/bulk";

const mockedPrisma = prisma as unknown as {
  feedbackAnalysis: { updateMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  feedbackLabel: { upsert: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> };
  feedbackItem: { deleteMany: ReturnType<typeof vi.fn> };
  feedbackArchive: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
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

  it("unlabel action deletes matching feedbackLabels", async () => {
    mockedPrisma.feedbackLabel.deleteMany.mockResolvedValue({ count: 2 });

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "unlabel",
      value: "bug",
    });

    expect(mockedPrisma.feedbackLabel.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.feedbackLabel.deleteMany).toHaveBeenCalledWith({
      where: { feedbackItemId: { in: ["a", "b"] }, labelId: "bug" },
    });
    expect(result.affected).toBe(2);
  });

  it("archive action creates an archive record per id", async () => {
    mockedPrisma.feedbackArchive.findUnique.mockResolvedValue(null);
    mockedPrisma.feedbackArchive.create.mockResolvedValue({});

    const result = await executeBulk(
      {
        ids: ["a", "b"],
        action: "archive",
        value: "resolved",
      },
      "user-1"
    );

    expect(mockedPrisma.feedbackArchive.create).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.feedbackArchive.create).toHaveBeenCalledWith({
      data: {
        feedbackItemId: "a",
        archivedById: "user-1",
        reason: "resolved",
      },
    });
    expect(result.affected).toBe(2);
  });

  it("unarchive action deletes archive records", async () => {
    mockedPrisma.feedbackArchive.deleteMany.mockResolvedValue({ count: 2 });

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "unarchive",
      value: "",
    });

    expect(mockedPrisma.feedbackArchive.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.feedbackArchive.deleteMany).toHaveBeenCalledWith({
      where: { feedbackItemId: { in: ["a", "b"] } },
    });
    expect(result.affected).toBe(2);
  });

  it("snooze action updates feedbackAnalysis with future date", async () => {
    mockedPrisma.feedbackAnalysis.update.mockResolvedValue({});
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "snooze",
      value: future,
    });

    expect(mockedPrisma.feedbackAnalysis.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.feedbackAnalysis.update).toHaveBeenCalledWith({
      where: { feedbackItemId: "a" },
      data: { snoozedUntil: new Date(future) },
    });
    expect(result.affected).toBe(2);
  });

  it("snooze action rejects past dates", async () => {
    const result = await executeBulk({
      ids: ["a", "b"],
      action: "snooze",
      value: "2020-01-01T00:00:00.000Z",
    });

    expect(result.affected).toBe(0);
    expect(result.errors).toHaveLength(2);
  });

  it("unsnooze action clears snoozedUntil", async () => {
    mockedPrisma.feedbackAnalysis.update.mockResolvedValue({});

    const result = await executeBulk({
      ids: ["a", "b"],
      action: "unsnooze",
      value: "",
    });

    expect(mockedPrisma.feedbackAnalysis.update).toHaveBeenCalledTimes(2);
    expect(mockedPrisma.feedbackAnalysis.update).toHaveBeenCalledWith({
      where: { feedbackItemId: "a" },
      data: { snoozedUntil: null },
    });
    expect(result.affected).toBe(2);
  });
});

// API-level zod validation (mirrors the route schema).
const BulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum([
    "status",
    "assign",
    "label",
    "unlabel",
    "delete",
    "archive",
    "unarchive",
    "snooze",
    "unsnooze",
  ]),
  value: z.string().default(""),
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
