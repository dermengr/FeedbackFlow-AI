import { prisma } from "@/lib/prisma";

/**
 * Assign (or unassign) a feedback item to a user for triage.
 *
 * Pass `null` for `assignedToId` to clear the current assignment.
 */
export async function assignFeedback(
  feedbackItemId: string,
  assignedToId: string | null
): Promise<void> {
  await prisma.feedbackAnalysis.update({
    where: { feedbackItemId },
    data: { assignedToId },
  });
}
