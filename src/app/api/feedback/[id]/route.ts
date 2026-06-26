import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES } from "@/lib/types";

// GET /api/feedback/:id - full detail (raw content + analysis)
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

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

  const updated = await prisma.feedbackAnalysis.update({
    where: { feedbackItemId: params.id },
    data: { status: parsed.data.status },
  });

  return NextResponse.json(updated);
}
