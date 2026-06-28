import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { archiveItem, unarchiveItem } from "@/lib/archive";
import { recordAuditEvent } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notification-dispatch";

const ArchiveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// POST /api/feedback/:id/archive - archive a feedback item.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ARCHIVE_WRITE);
  if (forbidden) return forbidden;

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ArchiveSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const archive = await archiveItem(params.id, userId, parsed.data.reason);

    const analysis = await prisma.feedbackAnalysis.findUnique({
      where: { feedbackItemId: params.id },
      select: { assignedToId: true, severityScore: true },
    });

    void recordAuditEvent({
      feedbackItemId: params.id,
      actorId: userId,
      type: "BULK_UPDATE",
      meta: { action: "archive", reason: parsed.data.reason },
    }).catch(() => {});

    if (analysis?.assignedToId && analysis.assignedToId !== userId) {
      const item = await prisma.feedbackItem.findUnique({
        where: { id: params.id },
        select: { title: true, externalId: true },
      });
      void dispatchNotification({
        userId: analysis.assignedToId,
        type: "feedback.archived",
        title: "Assigned feedback archived",
        body: `${item?.title ?? item?.externalId ?? "An assigned item"} was archived.`,
        feedbackItemId: params.id,
        severity: analysis.severityScore,
        link: `/inbox/${params.id}`,
      }).catch(() => {});
    }

    return NextResponse.json(archive, { status: 201 });
  } catch {
    // archiveItem throws when an archive record already exists.
    return NextResponse.json(
      { error: "Feedback item is already archived" },
      { status: 409 }
    );
  }
}

// DELETE /api/feedback/:id/archive - unarchive a feedback item.
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ARCHIVE_WRITE);
  if (forbidden) return forbidden;

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await unarchiveItem(params.id);

  const analysis = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackItemId: params.id },
    select: { assignedToId: true, severityScore: true },
  });

  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: auth.userId,
    type: "BULK_UPDATE",
    meta: { action: "unarchive" },
  }).catch(() => {});

  if (analysis?.assignedToId && analysis.assignedToId !== auth.userId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: analysis.assignedToId,
      type: "feedback.unarchived",
      title: "Assigned feedback unarchived",
      body: `${item?.title ?? item?.externalId ?? "An assigned item"} is active again.`,
      feedbackItemId: params.id,
      severity: analysis.severityScore,
      link: `/inbox/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
