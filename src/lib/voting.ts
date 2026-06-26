import { prisma } from "@/lib/prisma";

export type VoteType = "up" | "down" | "heart";

export const VOTE_TYPES: VoteType[] = ["up", "down", "heart"];

export interface VoteSummary {
  up: number;
  down: number;
  heart: number;
  total: number;
  userVotes: VoteType[];
}

/**
 * Cast a vote of the given type on a feedback item for the given user.
 *
 * Uses an upsert keyed on the unique [feedbackItemId, userId, type] constraint
 * so that re-casting the same vote is idempotent (no duplicate rows).
 */
export async function castVote(
  feedbackItemId: string,
  userId: string,
  type: VoteType
) {
  return prisma.feedbackVote.upsert({
    where: {
      feedbackItemId_userId_type: { feedbackItemId, userId, type },
    },
    update: {
      // No fields to change on a duplicate; just keep the existing row.
    },
    create: {
      feedbackItemId,
      userId,
      type,
    },
  });
}

/**
 * Remove a vote of the given type on a feedback item for the given user.
 * Returns the deleted record (or null if no matching vote existed).
 */
export async function removeVote(
  feedbackItemId: string,
  userId: string,
  type: VoteType
) {
  try {
    return await prisma.feedbackVote.delete({
      where: {
        feedbackItemId_userId_type: { feedbackItemId, userId, type },
      },
    });
  } catch {
    // Prisma throws P2025 when the record to delete is not found.
    return null;
  }
}

/**
 * Build a VoteSummary shape from raw per-type counts and the user's votes.
 */
function buildSummary(
  counts: Record<VoteType, number>,
  userVotes: VoteType[]
): VoteSummary {
  const up = counts.up ?? 0;
  const down = counts.down ?? 0;
  const heart = counts.heart ?? 0;
  return {
    up,
    down,
    heart,
    total: up + down + heart,
    userVotes,
  };
}

/**
 * Get a vote summary for a single feedback item: per-type counts plus the
 * current user's votes on that item.
 */
export async function getVoteSummary(
  feedbackItemId: string,
  userId?: string
): Promise<VoteSummary> {
  const grouped = await prisma.feedbackVote.groupBy({
    by: ["type"],
    where: { feedbackItemId },
    _count: { _all: true },
  });

  const counts: Record<VoteType, number> = { up: 0, down: 0, heart: 0 };
  for (const row of grouped) {
    counts[row.type as VoteType] = row._count._all;
  }

  let userVotes: VoteType[] = [];
  if (userId) {
    const mine = await prisma.feedbackVote.findMany({
      where: { feedbackItemId, userId },
      select: { type: true },
    });
    userVotes = mine.map((v) => v.type as VoteType);
  }

  return buildSummary(counts, userVotes);
}

/**
 * Get vote summaries for many feedback items at once, keyed by feedbackItemId.
 * Returns one summary per requested id (zeroed if there are no votes).
 */
export async function getBatchVoteSummaries(
  feedbackItemIds: string[],
  userId: string
): Promise<Record<string, VoteSummary>> {
  if (feedbackItemIds.length === 0) return {};

  const grouped = await prisma.feedbackVote.groupBy({
    by: ["feedbackItemId", "type"],
    where: { feedbackItemId: { in: feedbackItemIds } },
    _count: { _all: true },
  });

  const mine = await prisma.feedbackVote.findMany({
    where: { feedbackItemId: { in: feedbackItemIds }, userId },
    select: { feedbackItemId: true, type: true },
  });

  const result: Record<string, VoteSummary> = {};
  for (const id of feedbackItemIds) {
    result[id] = { up: 0, down: 0, heart: 0, total: 0, userVotes: [] };
  }

  for (const row of grouped) {
    const summary = result[row.feedbackItemId];
    if (!summary) continue;
    summary[row.type as VoteType] = row._count._all;
  }

  for (const vote of mine) {
    const summary = result[vote.feedbackItemId];
    if (!summary) continue;
    summary.userVotes.push(vote.type as VoteType);
  }

  for (const id of feedbackItemIds) {
    const s = result[id];
    s.total = s.up + s.down + s.heart;
  }

  return result;
}
