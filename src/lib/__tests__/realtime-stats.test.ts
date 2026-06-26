import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so getRealtimeStats can be exercised without a DB.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: {
      count: vi.fn(),
    },
    feedbackAnalysis: {
      count: vi.fn(),
    },
    feedbackComment: {
      count: vi.fn(),
    },
    ingestLog: {
      findMany: vi.fn(),
    },
  },
}));

import { getRealtimeStats, formatStatsForDisplay, formatRelativeTime } from "@/lib/realtime-stats";
import { prisma } from "@/lib/prisma";

describe("getRealtimeStats", () => {
  beforeEach(() => {
    vi.mocked(prisma.feedbackItem.count).mockReset();
    vi.mocked(prisma.feedbackAnalysis.count).mockReset();
    vi.mocked(prisma.feedbackComment.count).mockReset();
    vi.mocked(prisma.ingestLog.findMany).mockReset();
  });

  it("returns counts and the 5 most recent ingest runs", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(7);
    // First call = pending triage (NEW), second = unassigned high severity.
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(4);
    const runs = [
      { id: "r1", source: "GitHubIssues", status: "SUCCESS", itemsNew: 5, itemsFetched: 10, createdAt: new Date() },
      { id: "r2", source: "Reddit", status: "FAILURE", itemsNew: 0, itemsFetched: 0, createdAt: new Date() },
    ];
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue(runs as never);

    const stats = await getRealtimeStats();

    expect(stats).toEqual({
      lastHourItems: 7,
      pendingTriage: 12,
      unassignedHighSeverity: 3,
      lastHourComments: 4,
      recentIngestRuns: runs,
    });
  });

  it("filters feedback items by createdAt within the last hour", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(0);
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(0);
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue([] as never);

    await getRealtimeStats();

    const call = vi.mocked(prisma.feedbackItem.count).mock.calls[0];
    const where = call?.[0]?.where as { createdAt: { gte: Date } } | undefined;
    expect(where).toBeDefined();
    const gte = where!.createdAt.gte;
    // The gte boundary should be within the last hour (now-1h .. now).
    const age = Date.now() - gte.getTime();
    expect(age).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(age).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it("filters comments by createdAt within the last hour", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(0);
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(0);
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue([] as never);

    await getRealtimeStats();

    const call = vi.mocked(prisma.feedbackComment.count).mock.calls[0];
    const where = call?.[0]?.where as { createdAt: { gte: Date } } | undefined;
    expect(where).toBeDefined();
    const age = Date.now() - where!.createdAt.gte.getTime();
    expect(age).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(age).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it("counts pending triage with status = NEW", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(0);
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(0);
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue([] as never);

    const stats = await getRealtimeStats();

    expect(stats.pendingTriage).toBe(5);
    const firstCall = vi.mocked(prisma.feedbackAnalysis.count).mock.calls[0];
    expect(firstCall?.[0]?.where).toEqual({ status: "NEW" });
  });

  it("counts high severity (>=4) items with no assignee", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(0);
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(0);
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue([] as never);

    const stats = await getRealtimeStats();

    expect(stats.unassignedHighSeverity).toBe(2);
    const secondCall = vi.mocked(prisma.feedbackAnalysis.count).mock.calls[1];
    expect(secondCall?.[0]?.where).toEqual({
      severityScore: { gte: 4 },
      assignedToId: null,
    });
  });

  it("requests the 5 most recent ingest runs ordered by createdAt desc", async () => {
    vi.mocked(prisma.feedbackItem.count).mockResolvedValue(0);
    vi.mocked(prisma.feedbackAnalysis.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    vi.mocked(prisma.feedbackComment.count).mockResolvedValue(0);
    vi.mocked(prisma.ingestLog.findMany).mockResolvedValue([] as never);

    await getRealtimeStats();

    const call = vi.mocked(prisma.ingestLog.findMany).mock.calls[0];
    const args = call?.[0];
    expect(args?.orderBy).toEqual({ createdAt: "desc" });
    expect(args?.take).toBe(5);
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2024-01-01T12:00:00Z");

  it("returns 'just now' for < 60s", () => {
    expect(formatRelativeTime(new Date("2024-01-01T11:59:30Z"), now)).toBe("just now");
  });

  it("returns minutes for < 60m", () => {
    expect(formatRelativeTime(new Date("2024-01-01T11:55:00Z"), now)).toBe("5m ago");
  });

  it("returns hours for < 24h", () => {
    expect(formatRelativeTime(new Date("2024-01-01T10:00:00Z"), now)).toBe("2h ago");
  });

  it("returns days for >= 24h", () => {
    expect(formatRelativeTime(new Date("2023-12-29T12:00:00Z"), now)).toBe("3d ago");
  });
});

describe("formatStatsForDisplay", () => {
  const now = new Date("2024-01-01T12:00:00Z");

  it("pluralizes counts correctly and maps ingest runs", () => {
    const stats = {
      lastHourItems: 1,
      pendingTriage: 12,
      unassignedHighSeverity: 3,
      lastHourComments: 2,
      recentIngestRuns: [
        {
          id: "r1",
          source: "GitHubIssues",
          status: "SUCCESS",
          itemsNew: 5,
          itemsFetched: 10,
          createdAt: new Date("2024-01-01T11:55:00Z"),
        },
      ],
    };

    const out = formatStatsForDisplay(stats, now);

    expect(out.lastHourItems).toEqual({ value: 1, label: "1 item in last hour" });
    expect(out.pendingTriage).toEqual({ value: 12, label: "12 pending triage" });
    expect(out.unassignedHighSeverity).toEqual({
      value: 3,
      label: "3 unassigned critical",
    });
    expect(out.lastHourComments).toEqual({
      value: 2,
      label: "2 comments in last hour",
    });
    expect(out.recentIngestRuns).toHaveLength(1);
    expect(out.recentIngestRuns[0].relativeTime).toBe("5m ago");
    expect(out.recentIngestRuns[0].source).toBe("GitHubIssues");
  });

  it("pluralizes single pending triage and single comment", () => {
    const out = formatStatsForDisplay(
      {
        lastHourItems: 0,
        pendingTriage: 1,
        unassignedHighSeverity: 1,
        lastHourComments: 1,
        recentIngestRuns: [],
      },
      now
    );
    expect(out.pendingTriage.label).toBe("1 pending triage");
    expect(out.unassignedHighSeverity.label).toBe("1 unassigned critical");
    expect(out.lastHourComments.label).toBe("1 comment in last hour");
    expect(out.lastHourItems.label).toBe("0 items in last hour");
  });
});
