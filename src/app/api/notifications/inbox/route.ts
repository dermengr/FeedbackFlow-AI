import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  deleteNotification,
} from "@/lib/notification-dispatch";

// GET /api/notifications/inbox — return the current user's recent
// notifications and unread count.
// Query params:
//   limit  - max items to return (default 20, max 100)
//   unread - when "true", only return unread notifications
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const unreadOnly = searchParams.get("unread") === "true";

  try {
    let notifications = await getNotifications(auth.userId, limit);
    if (unreadOnly) {
      notifications = notifications.filter((n) => n.status === "unread");
    }
    const unreadCount = await getUnreadNotificationCount(auth.userId);
    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load notifications", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications/inbox — mark a notification as read.
// Body: { id: string }
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

// DELETE /api/notifications/inbox — delete a notification.
// Body: { id: string }
export async function DELETE(req: Request) {
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
    const { count } = await deleteNotification(auth.userId, id);
    return NextResponse.json({ success: count > 0 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete notification", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
