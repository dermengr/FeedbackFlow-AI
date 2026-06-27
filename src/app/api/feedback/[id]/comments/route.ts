import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { listComments, createComment } from "@/lib/comments";

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
  return NextResponse.json(comment, { status: 201 });
}
