import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { listAuditEvents } from "@/lib/audit";

// GET /api/feedback/:id/activity - audit log timeline for a feedback item.
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_FEEDBACK_READ);
  if (forbidden) return forbidden;

  const events = await listAuditEvents(params.id);
  return NextResponse.json({ events });
}
