import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { snoozeFeedback, unsnoozeFeedback } from "@/lib/snooze";
import { recordAuditEvent } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notification-dispatch";

const SnoozeSchema = z.object({
  until: z.string().datetime(),
});

// POST /api/feedback/:id/snooze - snooze a feedback item until a future date.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SNOOZE_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = SnoozeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const until = new Date(parsed.data.until);
  if (until.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Snooze date must be in the future" },
      { status: 400 }
    );
  }

  await snoozeFeedback(params.id, until);

  const analysis = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackItemId: params.id },
    select: { assignedToId: true, severityScore: true },
  });

  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: auth.userId,
    type: "SNOOZE",
    meta: { snoozedUntil: parsed.data.until },
  }).catch(() => {});

  if (analysis?.assignedToId && analysis.assignedToId !== auth.userId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: analysis.assignedToId,
      type: "feedback.snoozed",
      title: "Assigned feedback snoozed",
      body: `${item?.title ?? item?.externalId ?? "An assigned item"} was snoozed until ${until.toLocaleString()}.`,
      feedbackItemId: params.id,
      severity: analysis.severityScore,
      link: `/inbox/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, snoozedUntil: parsed.data.until });
}

// DELETE /api/feedback/:id/snooze - manually unsnooze a feedback item.
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SNOOZE_WRITE);
  if (forbidden) return forbidden;

  await unsnoozeFeedback(params.id);

  const analysis = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackItemId: params.id },
    select: { assignedToId: true, severityScore: true },
  });

  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: auth.userId,
    type: "UNSNOOZE",
  }).catch(() => {});

  if (analysis?.assignedToId && analysis.assignedToId !== auth.userId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: analysis.assignedToId,
      type: "feedback.unsnoozed",
      title: "Assigned feedback unsnoozed",
      body: `${item?.title ?? item?.externalId ?? "An assigned item"} is active again.`,
      feedbackItemId: params.id,
      severity: analysis.severityScore,
      link: `/inbox/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
