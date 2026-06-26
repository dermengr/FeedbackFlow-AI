import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so getHealthStatus can be tested without a database.
const { mockIngestFindFirst, mockIngestCount, mockItemCount, mockAnalysisFindMany } =
  vi.hoisted(() => ({
    mockIngestFindFirst: vi.fn(),
    mockIngestCount: vi.fn(),
    mockItemCount: vi.fn(),
    mockAnalysisFindMany: vi.fn(),
  }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    ingestLog: {
      findFirst: mockIngestFindFirst,
      count: mockIngestCount,
    },
    feedbackItem: {
      count: mockItemCount,
    },
    feedbackAnalysis: {
      findMany: mockAnalysisFindMany,
    },
  },
}));

beforeEach(() => {
  mockIngestFindFirst.mockReset();
  mockIngestCount.mockReset();
  mockItemCount.mockReset();
  mockAnalysisFindMany.mockReset();
});

import {
  determineOverallStatus,
  getHealthStatus,
  type HealthCheck,
} from "@/lib/health";

describe("determineOverallStatus", () => {
  const mk = (status: HealthCheck["status"]): HealthCheck => ({
    name: "x",
    status,
    detail: "",
    lastChecked: new Date(),
  });

  it("returns healthy when all checks are healthy", () => {
    expect(determineOverallStatus([mk("healthy"), mk("healthy")])).toBe(
      "healthy",
    );
  });

  it("returns degraded when one check is degraded (and none down)", () => {
    expect(determineOverallStatus([mk("healthy"), mk("degraded")])).toBe(
      "degraded",
    );
  });

  it("returns down when one check is down", () => {
    expect(
      determineOverallStatus([mk("healthy"), mk("degraded"), mk("down")]),
    ).toBe("down");
  });

  it("returns down even if others are degraded (down wins)", () => {
    expect(determineOverallStatus([mk("degraded"), mk("down")])).toBe("down");
  });

  it("returns healthy for an empty check list", () => {
    expect(determineOverallStatus([])).toBe("healthy");
  });
});

describe("getHealthStatus", () => {
  function setup(opts: {
    lastIngest?: {
      status: string;
      source: string;
      itemsNew?: number;
      itemsFetched?: number;
      createdAt: Date;
    } | null;
    totalIngests?: number;
    failedIngests?: number;
    pending?: number;
    analysed?: Array<{
      createdAt: Date;
      feedbackItem: { createdAt: Date };
    }>;
  }) {
    mockIngestFindFirst.mockResolvedValue(
      opts.lastIngest
        ? {
            id: "log1",
            status: opts.lastIngest.status,
            source: opts.lastIngest.source,
            itemsNew: opts.lastIngest.itemsNew ?? 0,
            itemsFetched: opts.lastIngest.itemsFetched ?? 0,
            createdAt: opts.lastIngest.createdAt,
          }
        : null,
    );
    // count is called twice for ingests: total then failed.
    mockIngestCount.mockResolvedValueOnce(opts.totalIngests ?? 0);
    mockIngestCount.mockResolvedValueOnce(opts.failedIngests ?? 0);
    mockItemCount.mockResolvedValue(opts.pending ?? 0);
    mockAnalysisFindMany.mockResolvedValue(opts.analysed ?? []);
  }

  it("reports degraded when there is no ingest history", async () => {
    setup({ lastIngest: null, totalIngests: 0, failedIngests: 0, pending: 0 });
    const result = await getHealthStatus();

    expect(result.lastIngest).toBeNull();
    expect(result.pendingAnalysis).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.avgProcessingTimeHours).toBeNull();
    // No ingests and no analyses => degraded (not down).
    expect(result.status).toBe("degraded");
    expect(result.checks).toHaveLength(4);
  });

  it("reports healthy for a recent successful ingest with no backlog", async () => {
    const recent = new Date(Date.now() - 10 * 60_000); // 10m ago
    setup({
      lastIngest: {
        status: "SUCCESS",
        source: "GitHubIssues",
        itemsNew: 5,
        itemsFetched: 10,
        createdAt: recent,
      },
      totalIngests: 10,
      failedIngests: 0,
      pending: 0,
      analysed: [
        {
          createdAt: new Date(recent.getTime() + 30 * 60_000),
          feedbackItem: { createdAt: recent },
        },
      ],
    });

    const result = await getHealthStatus();
    expect(result.status).toBe("healthy");
    expect(result.lastIngest?.status).toBe("SUCCESS");
    expect(result.lastIngest?.minutesAgo).toBeGreaterThanOrEqual(9);
    expect(result.errorRate).toBe(0);
    expect(result.avgProcessingTimeHours).toBeCloseTo(0.5, 1);
  });

  it("marks the system down when the last ingest failed", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    setup({
      lastIngest: {
        status: "FAILURE",
        source: "Trustpilot",
        createdAt: recent,
      },
      totalIngests: 4,
      failedIngests: 4,
      pending: 5,
    });

    const result = await getHealthStatus();
    expect(result.status).toBe("down");
    const ingestCheck = result.checks.find((c) => c.name === "Ingestion");
    expect(ingestCheck?.status).toBe("down");
  });

  it("calculates the error rate from failed/total ingests in the window", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: recent },
      totalIngests: 10,
      failedIngests: 3,
      pending: 0,
      analysed: [
        {
          createdAt: new Date(recent.getTime() + 60 * 60_000),
          feedbackItem: { createdAt: recent },
        },
      ],
    });

    const result = await getHealthStatus();
    expect(result.errorRate).toBeCloseTo(0.3, 5);
    const errCheck = result.checks.find((c) => c.name === "Error rate (24h)");
    // 30% is above the 20% degraded threshold but below 50% down threshold.
    expect(errCheck?.status).toBe("degraded");
  });

  it("marks error rate down at >= 50% failures", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: recent },
      totalIngests: 4,
      failedIngests: 2,
      pending: 0,
      analysed: [
        {
          createdAt: new Date(recent.getTime() + 60 * 60_000),
          feedbackItem: { createdAt: recent },
        },
      ],
    });

    const result = await getHealthStatus();
    expect(result.errorRate).toBe(0.5);
    const errCheck = result.checks.find((c) => c.name === "Error rate (24h)");
    expect(errCheck?.status).toBe("down");
  });

  it("degrades when pending analysis backlog is large", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: recent },
      totalIngests: 5,
      failedIngests: 0,
      pending: 75, // between 50 (degraded) and 200 (down)
      analysed: [
        {
          createdAt: new Date(recent.getTime() + 60 * 60_000),
          feedbackItem: { createdAt: recent },
        },
      ],
    });

    const result = await getHealthStatus();
    expect(result.pendingAnalysis).toBe(75);
    const pendingCheck = result.checks.find((c) => c.name === "Pending analysis");
    expect(pendingCheck?.status).toBe("degraded");
  });

  it("marks pending analysis down at >= 200 items", async () => {
    const recent = new Date(Date.now() - 5 * 60_000);
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: recent },
      totalIngests: 5,
      failedIngests: 0,
      pending: 250,
      analysed: [
        {
          createdAt: new Date(recent.getTime() + 60 * 60_000),
          feedbackItem: { createdAt: recent },
        },
      ],
    });

    const result = await getHealthStatus();
    const pendingCheck = result.checks.find((c) => c.name === "Pending analysis");
    expect(pendingCheck?.status).toBe("down");
  });

  it("averages processing time across multiple analysed items", async () => {
    const base = new Date(Date.now() - 60 * 60_000); // 1h ago
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: base },
      totalIngests: 5,
      failedIngests: 0,
      pending: 0,
      analysed: [
        // 1h and 3h => avg 2h
        {
          createdAt: new Date(base.getTime() + 1 * 3_600_000),
          feedbackItem: { createdAt: base },
        },
        {
          createdAt: new Date(base.getTime() + 3 * 3_600_000),
          feedbackItem: { createdAt: base },
        },
      ],
    });

    const result = await getHealthStatus();
    expect(result.avgProcessingTimeHours).toBeCloseTo(2, 5);
    const procCheck = result.checks.find((c) => c.name === "Avg processing time");
    expect(procCheck?.status).toBe("healthy");
  });

  it("marks processing time down when avg exceeds 24h", async () => {
    const base = new Date(Date.now() - 48 * 3_600_000); // 48h ago
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: base },
      totalIngests: 5,
      failedIngests: 0,
      pending: 0,
      analysed: [
        // 30h between ingest and analysis
        {
          createdAt: new Date(base.getTime() + 30 * 3_600_000),
          feedbackItem: { createdAt: base },
        },
      ],
    });

    const result = await getHealthStatus();
    const procCheck = result.checks.find((c) => c.name === "Avg processing time");
    expect(procCheck?.status).toBe("down");
  });

  it("degrades when the last successful ingest is stale", async () => {
    const stale = new Date(Date.now() - 8 * 3_600_000); // 8h ago
    setup({
      lastIngest: { status: "SUCCESS", source: "s", createdAt: stale },
      totalIngests: 5,
      failedIngests: 0,
      pending: 0,
      analysed: [
        {
          createdAt: new Date(stale.getTime() + 60 * 60_000),
          feedbackItem: { createdAt: stale },
        },
      ],
    });

    const result = await getHealthStatus();
    const ingestCheck = result.checks.find((c) => c.name === "Ingestion");
    expect(ingestCheck?.status).toBe("degraded");
  });

  it("handles empty data gracefully (no ingests, no analyses, no pending)", async () => {
    setup({ lastIngest: null, totalIngests: 0, failedIngests: 0, pending: 0 });
    const result = await getHealthStatus();

    expect(result.lastIngest).toBeNull();
    expect(result.pendingAnalysis).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.avgProcessingTimeHours).toBeNull();
    // Every check should be degraded (no data) — none should be down.
    expect(result.checks.every((c) => c.status !== "down")).toBe(true);
    expect(result.status).toBe("degraded");
  });
});
