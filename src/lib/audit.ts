import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Audit event types mirror the Prisma AuditEventType enum.
export type AuditType =
  | "STATUS_CHANGE"
  | "ASSIGN"
  | "UNASSIGN"
  | "COMMENT"
  | "LABEL_ADD"
  | "LABEL_REMOVE"
  | "SNOOZE"
  | "UNSNOOZE"
  | "BULK_UPDATE";

export interface AuditEventDto {
  id: string;
  type: AuditType;
  createdAt: string;
  actor: { id: string; name: string | null; email: string };
  meta: Record<string, unknown> | null;
}

/**
 * Record an audit event for a feedback item. Best-effort: any failure is
 * caught and logged as a warning so that audit logging never breaks the
 * calling triage operation.
 */
export async function recordAuditEvent(params: {
  feedbackItemId: string;
  actorId: string;
  type: AuditType;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const { feedbackItemId, actorId, type, meta } = params;
  try {
    await prisma.auditEvent.create({
      data: {
        feedbackItemId,
        actorId,
        type,
        meta: meta
          ? (meta as Prisma.InputJsonValue)
          : undefined,
      },
    });
  } catch (err) {
    console.warn(
      `[audit] failed to record event (${type}) for feedback item ${feedbackItemId}:`,
      err
    );
  }
}

/**
 * List the most recent audit events for a feedback item, newest first.
 * Dates are mapped to ISO strings for safe JSON serialization.
 */
export async function listAuditEvents(
  feedbackItemId: string
): Promise<AuditEventDto[]> {
  const events = await prisma.auditEvent.findMany({
    where: { feedbackItemId },
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return events.map((e) => ({
    id: e.id,
    type: e.type as AuditType,
    createdAt: e.createdAt.toISOString(),
    actor: {
      id: e.actor.id,
      name: e.actor.name,
      email: e.actor.email,
    },
    meta: (e.meta as Record<string, unknown> | null) ?? null,
  }));
}
