// Feedback archive service: archive, unarchive, query, and report on
// archived feedback items. Archived items are hidden from the active
// triage inbox but retained for historical/audit purposes.

import { prisma } from "@/lib/prisma";

/**
 * Archive a feedback item.
 *
 * Creates a FeedbackArchive record linking the item to the archiving user
 * and an optional reason. Throws if the item is already archived.
 *
 * @param feedbackItemId The feedback item to archive.
 * @param userId         The user performing the archive action.
 * @param reason         Optional human-readable reason for archiving.
 * @returns              The created FeedbackArchive record.
 */
export async function archiveItem(
  feedbackItemId: string,
  userId: string,
  reason?: string
) {
  const existing = await prisma.feedbackArchive.findUnique({
    where: { feedbackItemId },
  });
  if (existing) {
    throw new Error("Feedback item is already archived");
  }

  const normalizedReason = reason && reason.trim() ? reason.trim() : null;

  return prisma.feedbackArchive.create({
    data: {
      feedbackItemId,
      archivedById: userId,
      reason: normalizedReason,
    },
  });
}

/**
 * Remove a feedback item from the archive.
 *
 * Deletes the FeedbackArchive record, making the item reappear in the
 * active triage inbox. No-op safe: if the item was not archived, nothing
 * is deleted.
 *
 * @param feedbackItemId The feedback item to unarchive.
 */
export async function unarchiveItem(feedbackItemId: string): Promise<void> {
  await prisma.feedbackArchive.deleteMany({
    where: { feedbackItemId },
  });
}

/**
 * Check whether a feedback item is currently archived.
 *
 * @param feedbackItemId The feedback item to check.
 * @returns              `true` if an archive record exists for the item.
 */
export async function isArchived(feedbackItemId: string): Promise<boolean> {
  const record = await prisma.feedbackArchive.findUnique({
    where: { feedbackItemId },
    select: { id: true },
  });
  return record !== null;
}

/**
 * List archived feedback items with their archive metadata and feedback
 * details, paginated and ordered newest-first.
 *
 * @param page      1-based page number (defaults to 1).
 * @param pageSize  Number of items per page (defaults to 20).
 * @returns         `{ items, total, page, pageSize }` where each item
 *                  includes the archive record and its related feedback.
 */
export async function listArchived(page = 1, pageSize = 20) {
  const skip = Math.max(0, (page - 1) * pageSize);
  const take = Math.max(1, pageSize);

  const [items, total] = await Promise.all([
    prisma.feedbackArchive.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        feedbackItem: {
          select: {
            id: true,
            source: true,
            externalId: true,
            title: true,
            rawContent: true,
          },
        },
        archivedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.feedbackArchive.count(),
  ]);

  return { items, total, page, pageSize: take };
}

/**
 * Aggregate statistics about the feedback archive.
 *
 * @returns `{ totalArchived, archivedThisWeek, byReason }` where
 *          `byReason` maps each reason string (or `null` for no reason)
 *          to the number of archives with that reason.
 */
export async function getArchiveStats() {
  const startOfWeek = new Date();
  // Roll back to the most recent Monday 00:00:00 local time.
  const day = startOfWeek.getDay(); // 0 = Sunday
  const diffToMonday = (day + 6) % 7; // days since Monday
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

  const [totalArchived, archivedThisWeek, grouped] = await Promise.all([
    prisma.feedbackArchive.count(),
    prisma.feedbackArchive.count({
      where: { createdAt: { gte: startOfWeek } },
    }),
    prisma.feedbackArchive.groupBy({
      by: ["reason"],
      _count: { _all: true },
    }),
  ]);

  const byReason: Record<string, number> = {};
  for (const row of grouped) {
    const key = row.reason ?? "none";
    byReason[key] = row._count._all;
  }

  return { totalArchived, archivedThisWeek, byReason };
}
