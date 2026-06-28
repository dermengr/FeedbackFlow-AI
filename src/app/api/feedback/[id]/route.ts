import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES } from "@/lib/types";
import { recordAuditEvent } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notification-dispatch";

// GET /api/feedback/:id - full detail (raw content + analysis)
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_FEEDBACK_READ);
  if (forbidden) return forbidden;

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    include: { analysis: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(item);
}

const PatchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
});

// PATCH /api/feedback/:id - update triage status (bonus: User-Queued Actions)
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_FEEDBACK_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true, analysis: { select: { id: true } } },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!item.analysis) {
    return NextResponse.json(
      { error: "No analysis to update for this item" },
      { status: 409 }
    );
  }

  const previous = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackItemId: params.id },
    select: { status: true, assignedToId: true, severityScore: true },
  });

  const updated = await prisma.feedbackAnalysis.update({
    where: { feedbackItemId: params.id },
    data: { status: parsed.data.status },
  });

  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: auth.userId,
    type: "STATUS_CHANGE",
    meta: { from: previous?.status ?? null, to: parsed.data.status },
  }).catch(() => {});

  if (previous?.assignedToId && previous.assignedToId !== auth.userId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: previous.assignedToId,
      type: "feedback.status_changed",
      title: "Feedback status changed",
      body: `${item?.title ?? item?.externalId ?? "An assigned item"} is now ${parsed.data.status.toLowerCase()}.`,
      feedbackItemId: params.id,
      severity: previous.severityScore,
      link: `/inbox/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json(updated);
}
