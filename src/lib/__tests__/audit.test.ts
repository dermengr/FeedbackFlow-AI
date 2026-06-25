import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma before importing the module under test.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { recordAuditEvent, listAuditEvents } from "@/lib/audit";

const mockCreate = prisma.auditEvent.create as unknown as ReturnType<
  typeof vi.fn
>;
const mockFindMany = prisma.auditEvent.findMany as unknown as ReturnType<
  typeof vi.fn
>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("recordAuditEvent", () => {
  it("calls prisma.auditEvent.create with the correct data", async () => {
    mockCreate.mockResolvedValueOnce({ id: "evt_1" });

    await recordAuditEvent({
      feedbackItemId: "fb_1",
      actorId: "user_1",
      type: "STATUS_CHANGE",
      meta: { from: "NEW", to: "ACTIONED" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        feedbackItemId: "fb_1",
        actorId: "user_1",
        type: "STATUS_CHANGE",
        meta: { from: "NEW", to: "ACTIONED" },
      },
    });
  });

  it("passes meta as undefined when not provided", async () => {
    mockCreate.mockResolvedValueOnce({ id: "evt_2" });

    await recordAuditEvent({
      feedbackItemId: "fb_1",
      actorId: "user_1",
      type: "COMMENT",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        feedbackItemId: "fb_1",
        actorId: "user_1",
        type: "COMMENT",
        meta: undefined,
      },
    });
  });

  it("does NOT throw when prisma rejects (best-effort)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockCreate.mockRejectedValueOnce(new Error("db down"));

    await expect(
      recordAuditEvent({
        feedbackItemId: "fb_1",
        actorId: "user_1",
        type: "ASSIGN",
        meta: { assignee: "alice" },
      })
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

describe("listAuditEvents", () => {
  it("returns formatted events with ISO dates", async () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    mockFindMany.mockResolvedValueOnce([
      {
        id: "evt_1",
        type: "STATUS_CHANGE",
        createdAt: date,
        meta: { from: "NEW", to: "ACTIONED" },
        actor: { id: "user_1", name: "Alice", email: "alice@example.com" },
      },
      {
        id: "evt_2",
        type: "COMMENT",
        createdAt: date,
        meta: null,
        actor: { id: "user_2", name: null, email: "bob@example.com" },
      },
    ]);

    const result = await listAuditEvents("fb_1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { feedbackItemId: "fb_1" },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "evt_1",
      type: "STATUS_CHANGE",
      createdAt: date.toISOString(),
      actor: { id: "user_1", name: "Alice", email: "alice@example.com" },
      meta: { from: "NEW", to: "ACTIONED" },
    });
    expect(result[1].createdAt).toBe(date.toISOString());
    expect(result[1].meta).toBeNull();
    expect(result[1].actor.name).toBeNull();
  });

  it("returns an empty array when there are no events", async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const result = await listAuditEvents("fb_empty");
    expect(result).toEqual([]);
  });
});
