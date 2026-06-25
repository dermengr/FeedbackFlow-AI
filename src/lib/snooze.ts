// Snooze service: set, clear, and auto-expire snooze timestamps on
// feedback analyses. Used by the snooze API route and the cron runner.

import { prisma } from "@/lib/prisma";

/**
 * Snooze a feedback item until the given date.
 *
 * @param feedbackItemId The feedback item whose analysis should be snoozed.
 * @param until          The datetime until which the item should stay snoozed.
 */
export async function snoozeFeedback(
  feedbackItemId: string,
  until: Date
): Promise<void> {
  await prisma.feedbackAnalysis.update({
    where: { feedbackItemId },
    data: { snoozedUntil: until },
  });
}

/**
 * Manually unsnooze a feedback item (clear its snooze timestamp).
 *
 * @param feedbackItemId The feedback item whose analysis should be unsnoozed.
 */
export async function unsnoozeFeedback(
  feedbackItemId: string
): Promise<void> {
  await prisma.feedbackAnalysis.update({
    where: { feedbackItemId },
    data: { snoozedUntil: null },
  });
}

/**
 * Clear all snoozes whose `snoozedUntil` timestamp is in the past.
 *
 * Intended to be run on a cron schedule so that snoozed items automatically
 * resurface once their snooze window has elapsed.
 *
 * @returns The number of analyses that were unsnoozed.
 */
export async function clearExpiredSnoozes(): Promise<number> {
  const result = await prisma.feedbackAnalysis.updateMany({
    where: { snoozedUntil: { lt: new Date() } },
    data: { snoozedUntil: null },
  });
  return result.count;
}
