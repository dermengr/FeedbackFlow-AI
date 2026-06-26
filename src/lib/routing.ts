import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Routing rules drive automatic triage assignment. Each rule has a JSON
 * `conditions` blob that is evaluated against a feedback analysis. The
 * conditions format is:
 *
 *   {
 *     topics?: string[],     // analysis must include at least one of these
 *     minSeverity?: number,  // analysis.severityScore must be >= this value
 *     sentiment?: string,    // analysis.sentiment must equal this value
 *   }
 *
 * A rule matches when ALL specified conditions are met. Rules are evaluated in
 * priority order (lower number = higher priority) and the first matching rule's
 * assignee wins.
 */

export interface RoutingConditions {
  topics?: string[];
  minSeverity?: number;
  sentiment?: string;
}

export interface RoutingRuleDto {
  id: string;
  name: string;
  conditions: RoutingConditions;
  assigneeId: string;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string | null; email: string };
}

export interface CreateRoutingRuleInput {
  name: string;
  conditions: RoutingConditions;
  assigneeId: string;
  priority?: number;
}

export interface UpdateRoutingRuleInput {
  name?: string;
  conditions?: RoutingConditions;
  assigneeId?: string;
  enabled?: boolean;
  priority?: number;
}

export interface AnalysisForRouting {
  sentiment: string;
  topics: string[];
  severityScore: number;
}

function toDto(rule: {
  id: string;
  name: string;
  conditions: unknown;
  assigneeId: string;
  enabled: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  assignee?: { id: string; name: string | null; email: string };
}): RoutingRuleDto {
  return {
    id: rule.id,
    name: rule.name,
    conditions: (rule.conditions as RoutingConditions) ?? {},
    assigneeId: rule.assigneeId,
    enabled: rule.enabled,
    priority: rule.priority,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    assignee: rule.assignee,
  };
}

// createRoutingRule — create a new auto-assignment rule.
export async function createRoutingRule(
  data: CreateRoutingRuleInput
): Promise<RoutingRuleDto> {
  const rule = await prisma.routingRule.create({
    data: {
      name: data.name,
      conditions: data.conditions as unknown as Prisma.InputJsonValue,
      assigneeId: data.assigneeId,
      priority: data.priority ?? 0,
    },
    include: { assignee: true },
  });
  return toDto(rule);
}

// listRoutingRules — return all rules (with their assignee) ordered by priority.
export async function listRoutingRules(): Promise<RoutingRuleDto[]> {
  const rules = await prisma.routingRule.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    include: { assignee: true },
  });
  return rules.map(toDto);
}

// updateRoutingRule — update an existing rule's fields.
export async function updateRoutingRule(
  id: string,
  data: UpdateRoutingRuleInput
): Promise<RoutingRuleDto> {
  const rule = await prisma.routingRule.update({
    where: { id },
    data: {
      name: data.name,
      conditions: data.conditions
        ? (data.conditions as unknown as Prisma.InputJsonValue)
        : undefined,
      assigneeId: data.assigneeId,
      enabled: data.enabled,
      priority: data.priority,
    },
    include: { assignee: true },
  });
  return toDto(rule);
}

// deleteRoutingRule — remove a rule by id.
export async function deleteRoutingRule(id: string): Promise<void> {
  await prisma.routingRule.delete({ where: { id } });
}

/**
 * Evaluate whether a single rule's conditions match a given analysis.
 * A rule matches when every specified condition is satisfied. Conditions that
 * are omitted are treated as "no constraint" (i.e. always satisfied).
 */
export function matchesConditions(
  conditions: RoutingConditions,
  analysis: AnalysisForRouting
): boolean {
  if (conditions.topics && conditions.topics.length > 0) {
    const hasTopic = conditions.topics.some((t) =>
      analysis.topics.some((at) => at.toLowerCase() === t.toLowerCase())
    );
    if (!hasTopic) return false;
  }

  if (conditions.minSeverity !== undefined) {
    if (analysis.severityScore < conditions.minSeverity) return false;
  }

  if (conditions.sentiment !== undefined) {
    if (analysis.sentiment !== conditions.sentiment) return false;
  }

  return true;
}

/**
 * applyRoutingRules — evaluate enabled rules in priority order and return the
 * first matching rule's assigneeId, or null if none match.
 *
 * This overload accepts an already-fetched list of rules so the matching logic
 * is unit-testable without hitting the database.
 */
export async function applyRoutingRules(
  analysis: AnalysisForRouting,
  rules?: RoutingRuleDto[]
): Promise<string | null> {
  const enabledRules = (rules ?? (await listRoutingRules()))
    .filter((r) => r.enabled)
    .sort((a, b) =>
      a.priority === b.priority
        ? a.createdAt.getTime() - b.createdAt.getTime()
        : a.priority - b.priority
    );

  for (const rule of enabledRules) {
    if (matchesConditions(rule.conditions, analysis)) {
      return rule.assigneeId;
    }
  }

  return null;
}
