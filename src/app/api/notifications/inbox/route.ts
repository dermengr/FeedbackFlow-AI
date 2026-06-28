import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
} from "@/lib/notification-dispatch";

// GET /api/notifications/inbox — return the current user's recent
// notifications and unread count.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(auth.userId, limit),
      getUnreadNotificationCount(auth.userId),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load notifications", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/inbox/:id — mark a notification as read.
export async function PATCH(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id } = body as { id?: string };
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
  }

  try {
    const { count } = await markNotificationRead(auth.userId, id);
    return NextResponse.json({ success: count > 0 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update notification", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
