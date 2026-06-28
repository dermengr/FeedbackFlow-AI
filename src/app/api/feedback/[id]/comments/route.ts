import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { listComments, createComment } from "@/lib/comments";
import { recordAuditEvent } from "@/lib/audit";
import { dispatchNotification } from "@/lib/notification-dispatch";

// GET /api/feedback/:id/comments - list comments/notes on a feedback item
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_COMMENTS_WRITE);
  if (forbidden) return forbidden;

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await listComments(params.id);
  return NextResponse.json({ comments });
}

const CreateCommentSchema = z.object({
  body: z.string().min(1).max(5000),
});

// POST /api/feedback/:id/comments - add a comment/note to a feedback item
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_COMMENTS_WRITE);
  if (forbidden) return forbidden;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CreateCommentSchema.safeParse(payload);
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

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "No user id in session" }, { status: 401 });
  }
  const comment = await createComment(params.id, userId, parsed.data.body);

  const analysis = await prisma.feedbackAnalysis.findUnique({
    where: { feedbackItemId: params.id },
    select: { assignedToId: true, severityScore: true },
  });

  void recordAuditEvent({
    feedbackItemId: params.id,
    actorId: userId,
    type: "COMMENT",
    meta: { commentId: comment.id },
  }).catch(() => {});

  if (analysis?.assignedToId && analysis.assignedToId !== userId) {
    const item = await prisma.feedbackItem.findUnique({
      where: { id: params.id },
      select: { title: true, externalId: true },
    });
    void dispatchNotification({
      userId: analysis.assignedToId,
      type: "feedback.comment",
      title: "New comment on assigned feedback",
      body: `${item?.title ?? item?.externalId ?? "An assigned item"} received a new comment.`,
      feedbackItemId: params.id,
      severity: analysis.severityScore,
      link: `/inbox/${params.id}`,
    }).catch(() => {});
  }

  return NextResponse.json(comment, { status: 201 });
}
