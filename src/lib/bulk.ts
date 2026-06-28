import { FeedbackStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { archiveItem } from "@/lib/archive";
import { snoozeFeedback, unsnoozeFeedback } from "@/lib/snooze";

export type BulkAction =
  | "status"
  | "assign"
  | "label"
  | "unlabel"
  | "delete"
  | "archive"
  | "unarchive"
  | "snooze"
  | "unsnooze";

export interface BulkRequest {
  ids: string[]; // feedback item ids
  action: BulkAction;
  value: string; // status value, userId, labelId, reason, or ISO date; ignored for some actions
}

export interface BulkResult {
  affected: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Execute a bulk action across multiple feedback items.
 *
 * Supported actions:
 * - "status": set FeedbackAnalysis.status for each item.
 * - "assign": set FeedbackAnalysis.assignedToId for all items (null when value is empty).
 * - "label": assign a label to every selected item.
 * - "unlabel": remove a label from every selected item.
 * - "delete": delete all matching FeedbackItem rows.
 * - "archive": archive items with optional reason (value).
 * - "unarchive": restore archived items.
 * - "snooze": snooze items until the ISO date in value.
 * - "unsnooze": clear snooze for all selected items.
 *
 * Errors are collected per-item where applicable so a single failure does not
 * abort the whole batch.
 */
export async function executeBulk(
  req: BulkRequest,
  actorId?: string
): Promise<BulkResult> {
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

  if (action === "archive") {
    if (!actorId) {
      return { affected: 0, errors: ids.map((id) => ({ id, error: "Actor required for archive" })) };
    }
    let affected = 0;
    for (const id of ids) {
      try {
        await archiveItem(id, actorId, value);
        affected += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Archive failed";
        errors.push({ id, error: message });
      }
    }
    return { affected, errors };
  }

  if (action === "unarchive") {
    try {
      const result = await prisma.feedbackArchive.deleteMany({
        where: { feedbackItemId: { in: ids } },
      });
      return { affected: result.count, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unarchive failed";
      return { affected: 0, errors: ids.map((id) => ({ id, error: message })) };
    }
  }

  if (action === "snooze") {
    const until = new Date(value);
    if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
      return {
        affected: 0,
        errors: ids.map((id) => ({ id, error: "Invalid or past snooze date" })),
      };
    }
    let affected = 0;
    for (const id of ids) {
      try {
        await snoozeFeedback(id, until);
        affected += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Snooze failed";
        errors.push({ id, error: message });
      }
    }
    return { affected, errors };
  }

  if (action === "unsnooze") {
    let affected = 0;
    for (const id of ids) {
      try {
        await unsnoozeFeedback(id);
        affected += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unsnooze failed";
        errors.push({ id, error: message });
      }
    }
    return { affected, errors };
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

  if (action === "unlabel") {
    try {
      const result = await prisma.feedbackLabel.deleteMany({
        where: { feedbackItemId: { in: ids }, labelId: value },
      });
      return { affected: result.count, errors };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Label remove failed";
      return { affected: 0, errors: ids.map((id) => ({ id, error: message })) };
    }
  }

  return { affected, errors };
}
