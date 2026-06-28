import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { assignFeedback } from "@/lib/assign";
import { recordAuditEvent } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notification-dispatch";

const AssignSchema = z.object({
  assignedToId: z.string().nullable(),
});

// PATCH /api/feedback/:id/assign - assign/unassign a feedback item for triage
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ASSIGN_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = AssignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { assignedToId } = parsed.data;

  // Verify the feedback item exists.
  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If assigning to a user, verify the user exists.
  if (assignedToId !== null) {
    const user = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Assignee user not found" },
        { status: 400 }
      );
    }
  }

  await assignFeedback(params.id, assignedToId);

  // Record audit event and notify the affected user (if any) in the background.
  const auditType = assignedToId === null ? "UNASSIGN" : "ASSIGN";
  const link = `/inbox/${params.id}`;
  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: auth.userId,
    type: auditType,
    meta: { assignedToId },
  }).catch(() => {});

  if (assignedToId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: assignedToId,
      type: "feedback.assigned",
      title: "Feedback assigned to you",
      body: item?.title ?? item?.externalId ?? "A feedback item has been assigned to you.",
      feedbackItemId: params.id,
      link,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, assignedToId });
}
