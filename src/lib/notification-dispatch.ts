// Notification dispatch pipeline. Evaluates per-user preferences, persists a
// notification log record, and attempts delivery over enabled channels.

import { prisma } from "@/lib/prisma";
import { getNotificationPrefs, shouldNotifyUser } from "@/lib/notifications";

export type NotificationChannel = "email" | "slack" | "in_app";

export type NotificationPayload = {
  userId: string;
  type: string;
  title: string;
  body: string;
  severity?: number;
  feedbackItemId?: string;
  link?: string;
};

/**
 * Dispatch a notification to a single user. The notification is always logged
 * in-app. Email and Slack delivery are attempted only when the user's
 * notification preferences allow it.
 */
export async function dispatchNotification(payload: NotificationPayload) {
  const { userId, type, title, body, severity = 3, link } = payload;

  // Persist an in-app notification record for every dispatch so the user has a
  // complete history regardless of channel preferences.
  const notification = await prisma.notificationLog.create({
    data: {
      userId,
      type,
      title,
      body,
      status: "unread",
    },
  });

  // Evaluate preferences for external channels.
  const prefs = await getNotificationPrefs(userId);
  const allowed = await shouldNotifyUser(userId, type, severity);

  if (!allowed) {
    return { notification, emailSent: false, slackSent: false };
  }

  let emailSent = false;
  let slackSent = false;

  if (prefs.emailEnabled) {
    try {
      await sendEmailNotification({ title, body, link, userId });
      emailSent = true;
    } catch (err) {
      console.error("Failed to send email notification:", err);
    }
  }

  if (prefs.slackEnabled) {
    try {
      await sendSlackNotification({ title, body, link });
      slackSent = true;
    } catch (err) {
      console.error("Failed to send Slack notification:", err);
    }
  }

  return { notification, emailSent, slackSent };
}

/**
 * Send a notification to every user who should receive it for a given event.
 * This is useful for broadcasts (e.g. "new high-severity feedback") where the
 * caller does not want to enumerate users manually.
 */
export async function dispatchNotificationToAll(
  payload: Omit<NotificationPayload, "userId">,
  options: { severity?: number; excludeUserIds?: string[] } = {}
) {
  const users = await prisma.user.findMany({
    select: { id: true },
  });

  const exclude = new Set(options.excludeUserIds ?? []);
  const results = [];

  for (const user of users) {
    if (exclude.has(user.id)) continue;
    const ok = await shouldNotifyUser(user.id, payload.type, options.severity ?? payload.severity ?? 3);
    if (!ok) continue;
    results.push(dispatchNotification({ ...payload, userId: user.id }));
  }

  return Promise.all(results);
}

/**
 * Mark a notification as read for a user.
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string
) {
  return prisma.notificationLog.updateMany({
    where: { id: notificationId, userId },
    data: { status: "read" },
  });
}

/**
 * Return a user's recent notifications, newest first.
 */
export async function getNotifications(userId: string, limit = 50) {
  return prisma.notificationLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Count unread notifications for a user.
 */
export async function getUnreadNotificationCount(userId: string) {
  return prisma.notificationLog.count({
    where: { userId, status: "unread" },
  });
}

// ---------------------------------------------------------------------------
// Channel senders (placeholders — replace with real providers in production)
// ---------------------------------------------------------------------------

async function sendEmailNotification({
  title,
  body,
  link,
  userId,
}: {
  title: string;
  body: string;
  link?: string;
  userId: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  if (!user?.email) return;

  // In a production deployment this would integrate with an email provider such
  // as Resend, SendGrid, or AWS SES. For now, the dispatch is logged and the
  // in-app notification is the primary channel.
  console.log("[email notification]", {
    to: user.email,
    subject: title,
    text: link ? `${body}\n\n${link}` : body,
  });
}

async function sendSlackNotification({
  title,
  body,
  link,
}: {
  title: string;
  body: string;
  link?: string;
}) {
  const webhookUrl = process.env.SLACK_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) return;

  const text = link ? `${title}\n${body}\n${link}` : `${title}\n${body}`;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`Slack webhook returned ${res.status}`);
  }
}
