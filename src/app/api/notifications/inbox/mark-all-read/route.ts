import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { markAllNotificationsRead } from "@/lib/notification-dispatch";

// POST /api/notifications/inbox/mark-all-read — mark all unread notifications as read.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { count } = await markAllNotificationsRead(auth.userId);
    return NextResponse.json({ success: true, count });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to mark all notifications read", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
