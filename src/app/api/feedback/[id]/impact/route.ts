import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { getImpactForItem } from "@/lib/impact";

// GET /api/feedback/:id/impact — returns the impact score for a feedback
// item along with the per-component breakdown. Auth required.
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  // Verify the item exists so we can return a clean 404 distinct from the
  // "no analysis yet" case (which still yields a valid score of 0).
  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await getImpactForItem(params.id);

  return NextResponse.json(result);
}
