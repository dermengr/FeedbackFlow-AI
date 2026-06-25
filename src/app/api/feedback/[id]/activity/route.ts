import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listAuditEvents } from "@/lib/audit";

// GET /api/feedback/:id/activity - audit log timeline for a feedback item.
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const events = await listAuditEvents(params.id);
  return NextResponse.json({ events });
}
