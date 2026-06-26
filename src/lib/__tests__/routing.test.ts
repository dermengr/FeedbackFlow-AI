import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  matchesConditions,
  applyRoutingRules,
  type RoutingRuleDto,
} from "@/lib/routing";

// Mock prisma CRUD operations. The matching logic tests below pass an explicit
// list of rules to applyRoutingRules so the DB path is not exercised.
const { mockCreate, mockFindMany, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    routingRule: {
      create: mockCreate,
      findMany: mockFindMany,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

beforeEach(() => {
  mockCreate.mockReset();
  mockFindMany.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

import {
  createRoutingRule,
  listRoutingRules,
  updateRoutingRule,
  deleteRoutingRule,
} from "@/lib/routing";

function makeRule(
  overrides: Partial<RoutingRuleDto> = {}
): RoutingRuleDto {
  return {
    id: "rule-1",
    name: "Default rule",
    conditions: {},
    assigneeId: "user-1",
    enabled: true,
    priority: 0,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("matchesConditions", () => {
  const analysis = {
    sentiment: "negative",
    topics: ["Bug Report", "Performance"],
    severityScore: 4,
  };

  it("matches when topics overlap (case-insensitive)", () => {
    expect(
      matchesConditions({ topics: ["bug report"] }, analysis)
    ).toBe(true);
  });

  it("does not match when no topic overlaps", () => {
    expect(
      matchesConditions({ topics: ["Feature Request"] }, analysis)
    ).toBe(false);
  });

  it("matches when severityScore >= minSeverity", () => {
    expect(matchesConditions({ minSeverity: 4 }, analysis)).toBe(true);
  });

  it("does not match when severityScore < minSeverity", () => {
    expect(matchesConditions({ minSeverity: 5 }, analysis)).toBe(false);
  });

  it("matches when sentiment equals", () => {
    expect(matchesConditions({ sentiment: "negative" }, analysis)).toBe(true);
  });

  it("does not match when sentiment differs", () => {
    expect(matchesConditions({ sentiment: "positive" }, analysis)).toBe(false);
  });

  it("matches when all multiple conditions are satisfied", () => {
    expect(
      matchesConditions(
        { topics: ["Bug Report"], minSeverity: 3, sentiment: "negative" },
        analysis
      )
    ).toBe(true);
  });

  it("does not match when any one of multiple conditions fails", () => {
    expect(
      matchesConditions(
        { topics: ["Bug Report"], minSeverity: 5, sentiment: "negative" },
        analysis
      )
    ).toBe(false);
  });

  it("matches when no conditions are specified (empty rule)", () => {
    expect(matchesConditions({}, analysis)).toBe(true);
  });
});

describe("applyRoutingRules", () => {
  const analysis = {
    sentiment: "negative",
    topics: ["Bug Report"],
    severityScore: 4,
  };

  it("returns the assigneeId of the first matching rule", async () => {
    const rules = [
      makeRule({
        id: "rule-a",
        conditions: { topics: ["Feature Request"] },
        assigneeId: "user-a",
        priority: 0,
      }),
      makeRule({
        id: "rule-b",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-b",
        priority: 1,
      }),
    ];

    const result = await applyRoutingRules(analysis, rules);
    expect(result).toBe("user-b");
  });

  it("respects priority ordering (lower number first)", async () => {
    const rules = [
      makeRule({
        id: "rule-low-prio",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-low",
        priority: 10,
      }),
      makeRule({
        id: "rule-high-prio",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-high",
        priority: 1,
      }),
    ];

    const result = await applyRoutingRules(analysis, rules);
    expect(result).toBe("user-high");
  });

  it("returns null when no rules match", async () => {
    const rules = [
      makeRule({
        conditions: { topics: ["Feature Request"] },
        assigneeId: "user-x",
      }),
      makeRule({
        conditions: { sentiment: "positive" },
        assigneeId: "user-y",
      }),
    ];

    const result = await applyRoutingRules(analysis, rules);
    expect(result).toBeNull();
  });

  it("skips disabled rules even if they would match", async () => {
    const rules = [
      makeRule({
        id: "disabled",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-disabled",
        enabled: false,
        priority: 0,
      }),
      makeRule({
        id: "enabled",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-enabled",
        priority: 1,
      }),
    ];

    const result = await applyRoutingRules(analysis, rules);
    expect(result).toBe("user-enabled");
  });

  it("returns null for an empty rule list", async () => {
    const result = await applyRoutingRules(analysis, []);
    expect(result).toBeNull();
  });

  it("falls back to createdAt when priorities are equal", async () => {
    const rules = [
      makeRule({
        id: "rule-later",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-later",
        priority: 5,
        createdAt: new Date("2024-02-01T00:00:00Z"),
      }),
      makeRule({
        id: "rule-earlier",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-earlier",
        priority: 5,
        createdAt: new Date("2024-01-01T00:00:00Z"),
      }),
    ];

    const result = await applyRoutingRules(analysis, rules);
    expect(result).toBe("user-earlier");
  });
});

describe("routing CRUD (prisma mocked)", () => {
  it("createRoutingRule calls prisma.routingRule.create with the right data", async () => {
    const created = {
      id: "rule-1",
      name: "Bug triage",
      conditions: { topics: ["Bug Report"] },
      assigneeId: "user-1",
      enabled: true,
      priority: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: { id: "user-1", name: "Alice", email: "alice@example.com" },
    };
    mockCreate.mockResolvedValue(created);

    const result = await createRoutingRule({
      name: "Bug triage",
      conditions: { topics: ["Bug Report"] },
      assigneeId: "user-1",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "Bug triage",
        conditions: { topics: ["Bug Report"] },
        assigneeId: "user-1",
        priority: 0,
      },
      include: { assignee: true },
    });
    expect(result.id).toBe("rule-1");
  });

  it("createRoutingRule honors an explicit priority", async () => {
    mockCreate.mockResolvedValue({
      id: "rule-2",
      name: "High prio",
      conditions: {},
      assigneeId: "user-2",
      enabled: true,
      priority: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: { id: "user-2", name: null, email: "b@example.com" },
    });

    await createRoutingRule({
      name: "High prio",
      conditions: {},
      assigneeId: "user-2",
      priority: 3,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        name: "High prio",
        conditions: {},
        assigneeId: "user-2",
        priority: 3,
      },
      include: { assignee: true },
    });
  });

  it("listRoutingRules calls findMany with priority ordering and assignee include", async () => {
    mockFindMany.mockResolvedValue([
      {
        id: "rule-1",
        name: "A",
        conditions: {},
        assigneeId: "user-1",
        enabled: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        assignee: { id: "user-1", name: "Alice", email: "a@example.com" },
      },
    ]);

    const rules = await listRoutingRules();

    expect(mockFindMany).toHaveBeenCalledWith({
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      include: { assignee: true },
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].assignee?.email).toBe("a@example.com");
  });

  it("updateRoutingRule calls prisma.routingRule.update", async () => {
    mockUpdate.mockResolvedValue({
      id: "rule-1",
      name: "Updated",
      conditions: { sentiment: "negative" },
      assigneeId: "user-1",
      enabled: false,
      priority: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
      assignee: { id: "user-1", name: "Alice", email: "a@example.com" },
    });

    await updateRoutingRule("rule-1", { enabled: false, priority: 2 });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { enabled: false, priority: 2 },
      include: { assignee: true },
    });
  });

  it("deleteRoutingRule calls prisma.routingRule.delete", async () => {
    mockDelete.mockResolvedValue({});

    await deleteRoutingRule("rule-1");

    expect(mockDelete).toHaveBeenCalledWith({ where: { id: "rule-1" } });
  });
});
