import { FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BulkAction = "status" | "assign" | "label" | "delete";

export interface BulkRequest {
  ids: string[]; // feedback item ids
  action: BulkAction;
  value: string; // status value, userId, labelId, or ignored for delete
}

export interface BulkResult {
  affected: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Execute a bulk action across multiple feedback items.
 *
 * - "status": set FeedbackAnalysis.status for each item.
 * - "assign": set FeedbackAnalysis.assignedToId for all items (null when value is empty).
 * - "label": upsert a FeedbackLabel row for each item.
 * - "delete": delete all matching FeedbackItem rows.
 *
 * Errors are collected per-item where applicable so a single failure does not
 * abort the whole batch.
 */
export async function executeBulk(req: BulkRequest): Promise<BulkResult> {
  const { ids, action, value } = req;
  const errors: Array<{ id: string; error: string }> = [];

  if (action === "delete") {
    try {
      const result = await prisma.feedbackItem.deleteMany({
        where: { id: { in: ids } },
      });
      return { affected: result.count, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete failed";
      return { affected: 0, errors: ids.map((id) => ({ id, error: message })) };
    }
  }

  if (action === "assign") {
    try {
      const result = await prisma.feedbackAnalysis.updateMany({
        where: { feedbackItemId: { in: ids } },
        data: { assignedToId: value || null },
      });
      return { affected: result.count, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assign failed";
      return { affected: 0, errors: ids.map((id) => ({ id, error: message })) };
    }
  }

  let affected = 0;

  if (action === "status") {
    for (const id of ids) {
      try {
        const result = await prisma.feedbackAnalysis.updateMany({
          where: { feedbackItemId: id },
          data: { status: value as FeedbackStatus },
        });
        affected += result.count;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Status update failed";
        errors.push({ id, error: message });
      }
    }
    return { affected, errors };
  }

  if (action === "label") {
    for (const id of ids) {
      try {
        await prisma.feedbackLabel.upsert({
          where: {
            feedbackItemId_labelId: { feedbackItemId: id, labelId: value },
          },
          create: { feedbackItemId: id, labelId: value },
          update: {},
        });
        affected += 1;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Label upsert failed";
        errors.push({ id, error: message });
      }
    }
    return { affected, errors };
  }

  return { affected, errors };
}
