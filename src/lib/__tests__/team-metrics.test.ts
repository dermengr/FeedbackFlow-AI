import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUserFindMany, mockFeedbackFindMany, mockTeamMetricUpsert } =
  vi.hoisted(() => ({
    mockUserFindMany: vi.fn(),
    mockFeedbackFindMany: vi.fn(),
    mockTeamMetricUpsert: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: mockUserFindMany },
    feedbackAnalysis: { findMany: mockFeedbackFindMany },
    teamMetric: { upsert: mockTeamMetricUpsert },
  },
}));

import {
  computeMemberMetrics,
  getTeamMetrics,
  getPeriodRange,
  snapshotTeamMetrics,
} from "@/lib/team-metrics";

const HOURS = 60 * 60 * 1000;
const days = (n: number) => new Date(Date.now() - n * 24 * HOURS);
const hoursAgo = (n: number) => new Date(Date.now() - n * HOURS);

describe("computeMemberMetrics", () => {
  it("counts assigned and actioned records and computes the actioned rate", () => {
    const metrics = computeMemberMetrics("u1", "Alice", "alice@x.com", [
      { status: "NEW", createdAt: days(2), updatedAt: days(1) },
      { status: "ACTIONED", createdAt: days(3), updatedAt: days(1) },
      { status: "ACTIONED", createdAt: days(4), updatedAt: days(2) },
    ]);

    expect(metrics.assignedCount).toBe(3);
    expect(metrics.actionedCount).toBe(2);
    // 2/3 * 100
    expect(metrics.actionedRate).toBeCloseTo(66.6667, 1);
  });

  it("computes average response time from updatedAt - createdAt for actioned items only", () => {
    const base = Date.now();
    const metrics = computeMemberMetrics("u1", "Alice", "alice@x.com", [
      // 48h response, actioned
      {
        status: "ACTIONED",
        createdAt: new Date(base - 48 * HOURS),
        updatedAt: new Date(base),
      },
      // 24h response, actioned
      {
        status: "ACTIONED",
        createdAt: new Date(base - 24 * HOURS),
        updatedAt: new Date(base),
      },
      // NEW (not actioned) — should be excluded from avg
      {
        status: "NEW",
        createdAt: new Date(base - 100 * HOURS),
        updatedAt: new Date(base),
      },
    ]);

    // (48 + 24) / 2 = 36
    expect(metrics.avgResponseHours).toBeCloseTo(36, 5);
  });

  it("returns 0 avg response time when nothing has been actioned", () => {
    const metrics = computeMemberMetrics("u1", "Alice", "alice@x.com", [
      { status: "NEW", createdAt: days(2), updatedAt: days(1) },
      { status: "ACKNOWLEDGED", createdAt: days(3), updatedAt: days(1) },
    ]);

    expect(metrics.actionedCount).toBe(0);
    expect(metrics.avgResponseHours).toBe(0);
    expect(metrics.actionedRate).toBe(0);
  });

  it("handles an empty assignment list (empty team member)", () => {
    const metrics = computeMemberMetrics("u1", "Alice", "alice@x.com", []);

    expect(metrics.assignedCount).toBe(0);
    expect(metrics.actionedCount).toBe(0);
    expect(metrics.avgResponseHours).toBe(0);
    expect(metrics.actionedRate).toBe(0);
  });

  it("falls back to email when name is null", () => {
    const metrics = computeMemberMetrics("u1", "alice@x.com", "alice@x.com", []);
    expect(metrics.userName).toBe("alice@x.com");
  });
});

describe("getPeriodRange", () => {
  it("daily spans 24 hours", () => {
    const { periodStart, periodEnd } = getPeriodRange("daily");
    const diffH = (periodEnd.getTime() - periodStart.getTime()) / HOURS;
    expect(diffH).toBeCloseTo(24, 5);
  });

  it("weekly spans 7 days", () => {
    const { periodStart, periodEnd } = getPeriodRange("weekly");
    const diffH = (periodEnd.getTime() - periodStart.getTime()) / HOURS;
    expect(diffH).toBeCloseTo(24 * 7, 5);
  });

  it("monthly spans 30 days", () => {
    const { periodStart, periodEnd } = getPeriodRange("monthly");
    const diffH = (periodEnd.getTime() - periodStart.getTime()) / HOURS;
    expect(diffH).toBeCloseTo(24 * 30, 5);
  });
});

describe("getTeamMetrics", () => {
  beforeEach(() => {
    mockUserFindMany.mockReset();
    mockFeedbackFindMany.mockReset();
  });

  it("returns one entry per user, joining their assigned analyses", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@x.com" },
      { id: "u2", name: "Bob", email: "bob@x.com" },
    ]);
    mockFeedbackFindMany.mockResolvedValue([
      { assignedToId: "u1", status: "ACTIONED", createdAt: hoursAgo(48), updatedAt: hoursAgo(0) },
      { assignedToId: "u1", status: "NEW", createdAt: hoursAgo(10), updatedAt: hoursAgo(5) },
      { assignedToId: "u2", status: "ACTIONED", createdAt: hoursAgo(24), updatedAt: hoursAgo(0) },
    ]);

    const metrics = await getTeamMetrics("weekly");
    const byId = new Map(metrics.map((m) => [m.userId, m]));

    const alice = byId.get("u1")!;
    expect(alice.assignedCount).toBe(2);
    expect(alice.actionedCount).toBe(1);
    expect(alice.actionedRate).toBeCloseTo(50, 5);
    // 48h for the single actioned item
    expect(alice.avgResponseHours).toBeCloseTo(48, 5);

    const bob = byId.get("u2")!;
    expect(bob.assignedCount).toBe(1);
    expect(bob.actionedCount).toBe(1);
    expect(bob.actionedRate).toBe(100);
  });

  it("returns empty metrics for an empty team (no users)", async () => {
    mockUserFindMany.mockResolvedValue([]);
    mockFeedbackFindMany.mockResolvedValue([]);

    const metrics = await getTeamMetrics("weekly");
    expect(metrics).toEqual([]);
  });

  it("returns zeroed metrics for users with no assignments", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@x.com" },
    ]);
    mockFeedbackFindMany.mockResolvedValue([]);

    const metrics = await getTeamMetrics("weekly");
    expect(metrics).toHaveLength(1);
    expect(metrics[0].assignedCount).toBe(0);
    expect(metrics[0].actionedCount).toBe(0);
    expect(metrics[0].actionedRate).toBe(0);
    expect(metrics[0].avgResponseHours).toBe(0);
  });
});

describe("snapshotTeamMetrics", () => {
  beforeEach(() => {
    mockUserFindMany.mockReset();
    mockFeedbackFindMany.mockReset();
    mockTeamMetricUpsert.mockReset();
  });

  it("upserts one TeamMetric row per user", async () => {
    mockUserFindMany.mockResolvedValue([
      { id: "u1", name: "Alice", email: "alice@x.com" },
      { id: "u2", name: "Bob", email: "bob@x.com" },
    ]);
    mockFeedbackFindMany.mockResolvedValue([
      { assignedToId: "u1", status: "ACTIONED", createdAt: hoursAgo(48), updatedAt: hoursAgo(0) },
    ]);
    mockTeamMetricUpsert.mockResolvedValue({});

    await snapshotTeamMetrics("weekly");

    expect(mockTeamMetricUpsert).toHaveBeenCalledTimes(2);
    // Alice should have an upsert with her computed counts.
    const aliceCall = mockTeamMetricUpsert.mock.calls.find(
      (c) => c[0].where.userId_period_periodStart.userId === "u1"
    );
    expect(aliceCall).toBeDefined();
    expect(aliceCall![0].create.assignedCount).toBe(1);
    expect(aliceCall![0].create.actionedCount).toBe(1);
    expect(aliceCall![0].create.period).toBe("weekly");
  });
});
