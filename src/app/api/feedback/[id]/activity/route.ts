import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { listAuditEvents } from "@/lib/audit";

// GET /api/feedback/:id/activity - audit log timeline for a feedback item.
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const events = await listAuditEvents(params.id);
  return NextResponse.json({ events });
}
