import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Impact Score
// ---------------------------------------------------------------------------
// A 0-100 score reflecting the raw impact of a feedback item based on its
// analysis severity, community votes, and the number of duplicate reports.
//
// Formula (no age decay — raw impact only):
//   severityComponent = min(severityScore * 15, 75)   // max 75
//   voteComponent     = min(voteCount, 10) * 1.5       // max 15
//   duplicateComponent= min(duplicateCount, 5) * 2     // max 10
//   score             = severityComponent + voteComponent + duplicateComponent
//
// The theoretical maximum is 75 + 15 + 10 = 100.

export interface ImpactScoreParams {
  severityScore: number;
  voteCount: number;
  duplicateCount: number;
  ageInDays: number;
}

export interface ImpactScoreResult {
  score: number;
  breakdown: {
    severity: number;
    votes: number;
    duplicates: number;
    ageInDays: number;
  };
}

/**
 * Calculate an impact score (0-100) from the raw component inputs.
 * `ageInDays` is accepted for API completeness but does not factor into the
 * raw impact calculation (no age decay).
 */
export function calculateImpactScore(
  params: ImpactScoreParams
): ImpactScoreResult {
  const { severityScore, voteCount, duplicateCount, ageInDays } = params;

  const severity = Math.min(severityScore * 15, 75);
  const votes = Math.min(voteCount, 10) * 1.5;
  const duplicates = Math.min(duplicateCount, 5) * 2;

  const score = Math.round((severity + votes + duplicates) * 100) / 100;

  return {
    score,
    breakdown: {
      severity,
      votes,
      duplicates,
      ageInDays,
    },
  };
}

/**
 * Compute the impact score for a persisted feedback item by querying:
 *   - the analysis severityScore (defaults to 0 if no analysis)
 *   - the number of votes on the item
 *   - the number of "duplicate" FeedbackLinks referencing the item
 *   - the age in days since the item's originalTimestamp
 *
 * Returns null if the feedback item does not exist.
 */
export async function getImpactForItem(
  feedbackItemId: string
): Promise<ImpactScoreResult | null> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    select: {
      id: true,
      originalTimestamp: true,
      analysis: { select: { severityScore: true } },
      _count: {
        select: {
          votes: true,
          linksFrom: { where: { relationType: "duplicate" } },
          linksTo: { where: { relationType: "duplicate" } },
        },
      },
    },
  });

  if (!item) {
    return null;
  }

  const severityScore = item.analysis?.severityScore ?? 0;
  const voteCount = item._count.votes;
  // A duplicate link may point either direction (from or to this item).
  const duplicateCount = item._count.linksFrom + item._count.linksTo;

  const ageInDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(item.originalTimestamp).getTime()) /
        (1000 * 60 * 60 * 24)
    )
  );

  return calculateImpactScore({
    severityScore,
    voteCount,
    duplicateCount,
    ageInDays,
  });
}
