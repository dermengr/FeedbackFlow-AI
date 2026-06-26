import { prisma } from "@/lib/prisma";
import type { FeedbackStatus } from "@prisma/client";

export interface FunnelStage {
  name: "NEW" | "ACKNOWLEDGED" | "ACTIONED";
  count: number;
  percentage: number; // share of the NEW (top-of-funnel) count, 0-100
}

export interface ConversionRates {
  newToAcknowledged: number; // ACKNOWLEDGED + ACTIONED vs NEW, 0-100
  acknowledgedToActioned: number; // ACTIONED vs ACKNOWLEDGED + ACTIONED, 0-100
  overall: number; // ACTIONED vs NEW, 0-100
}

export interface FunnelData {
  stages: FunnelStage[];
  conversionRates: ConversionRates;
}

// Order of the triage funnel stages, from top to bottom.
const STAGE_ORDER: FunnelStage["name"][] = [
  "NEW",
  "ACKNOWLEDGED",
  "ACTIONED",
];

// Pure helper: compute conversion rates from a list of funnel stages.
// Stages are expected in NEW -> ACKNOWLEDGED -> ACTIONED order.
// - newToAcknowledged:        (ACKNOWLEDGED + ACTIONED) / NEW
// - acknowledgedToActioned:   ACTIONED / (ACKNOWLEDGED + ACTIONED)
// - overall:                  ACTIONED / NEW
// All rates are returned as percentages (0-100). When a denominator is 0
// the rate is 0 to avoid NaN/Infinity.
export function calculateConversionRates(stages: FunnelStage[]): ConversionRates {
  const get = (name: FunnelStage["name"]) =>
    stages.find((s) => s.name === name)?.count ?? 0;

  const newCount = get("NEW");
  const acknowledgedCount = get("ACKNOWLEDGED");
  const actionedCount = get("ACTIONED");

  const acknowledgedPlusActioned = acknowledgedCount + actionedCount;

  const newToAcknowledged =
    newCount > 0 ? (acknowledgedPlusActioned / newCount) * 100 : 0;
  const acknowledgedToActioned =
    acknowledgedPlusActioned > 0
      ? (actionedCount / acknowledgedPlusActioned) * 100
      : 0;
  const overall = newCount > 0 ? (actionedCount / newCount) * 100 : 0;

  return {
    newToAcknowledged,
    acknowledgedToActioned,
    overall,
  };
}

// Count FeedbackAnalysis records by status within the last `days` days and
// build the triage funnel (NEW -> ACKNOWLEDGED -> ACTIONED) with conversion
// rates between stages.
export async function getFunnelData(days: number): Promise<FunnelData> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const groupings = await prisma.feedbackAnalysis.groupBy({
    by: ["status"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });

  // Build a lookup of status -> count, defaulting to 0 for missing statuses.
  const countsByStatus = new Map<FeedbackStatus, number>();
  for (const g of groupings) {
    countsByStatus.set(g.status, g._count._all);
  }

  const newCount = countsByStatus.get("NEW") ?? 0;
  const topOfFunnel = newCount;

  const stages: FunnelStage[] = STAGE_ORDER.map((name) => {
    const count = countsByStatus.get(name) ?? 0;
    const percentage =
      topOfFunnel > 0 ? (count / topOfFunnel) * 100 : 0;
    return { name, count, percentage };
  });

  const conversionRates = calculateConversionRates(stages);

  return { stages, conversionRates };
}
