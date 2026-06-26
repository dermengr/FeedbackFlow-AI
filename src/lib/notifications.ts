// Notification preferences service: read, update, and evaluate per-user
// notification settings. Used by the /api/notifications route and the
// notification dispatch pipeline.

import { prisma } from "@/lib/prisma";
import { NotificationPref } from "@prisma/client";

// Default preferences applied when a user has no existing record. These
// mirror the Prisma model defaults so that newly created rows match what
// callers receive from `getNotificationPrefs` before persistence.
export const DEFAULT_PREFS = {
  emailEnabled: true,
  slackEnabled: false,
  minSeverity: 3,
  digestFrequency: "daily",
} as const;

export type NotificationPrefUpdate = {
  emailEnabled?: boolean;
  slackEnabled?: boolean;
  minSeverity?: number;
  digestFrequency?: string;
};

/**
 * Return a user's notification preferences. If the user has no preferences
 * row yet, create one with the default values and return it. This guarantees
 * callers always receive a concrete record (never null) and that the default
 * row is persisted so subsequent updates can target it.
 *
 * @param userId The user whose preferences should be loaded.
 */
export async function getNotificationPrefs(
  userId: string
): Promise<NotificationPref> {
  return prisma.notificationPref.upsert({
    where: { userId },
    create: {
      userId,
      ...DEFAULT_PREFS,
    },
    update: {},
  });
}

/**
 * Update a user's notification preferences. Only the supplied fields are
 * written; omitted fields are left untouched. Ensures a preferences row
 * exists before updating (creates a default row if missing) so the update
 * never fails due to a missing record.
 *
 * @param userId The user whose preferences should be updated.
 * @param data   Partial preferences payload.
 */
export async function updateNotificationPrefs(
  userId: string,
  data: NotificationPrefUpdate
): Promise<NotificationPref> {
  // Ensure a row exists before updating. upsert avoids a race between the
  // findUnique and create/update that a get-then-write sequence would have.
  return prisma.notificationPref.upsert({
    where: { userId },
    create: {
      userId,
      emailEnabled: data.emailEnabled ?? DEFAULT_PREFS.emailEnabled,
      slackEnabled: data.slackEnabled ?? DEFAULT_PREFS.slackEnabled,
      minSeverity: data.minSeverity ?? DEFAULT_PREFS.minSeverity,
      digestFrequency: data.digestFrequency ?? DEFAULT_PREFS.digestFrequency,
    },
    update: {
      ...(data.emailEnabled !== undefined && { emailEnabled: data.emailEnabled }),
      ...(data.slackEnabled !== undefined && { slackEnabled: data.slackEnabled }),
      ...(data.minSeverity !== undefined && { minSeverity: data.minSeverity }),
      ...(data.digestFrequency !== undefined && {
        digestFrequency: data.digestFrequency,
      }),
    },
  });
}

/**
 * Decide whether a user should be notified about a given event.
 *
 * A notification is sent only when ALL of the following hold:
 *   - At least one delivery channel (email or slack) is enabled.
 *   - The event's severity is greater than or equal to the user's
 *     `minSeverity` threshold (severity is 1-5, higher = more severe).
 *
 * The `eventType` is accepted for future per-event filtering (e.g. allowing
 * users to mute specific event types); today it does not affect the result.
 *
 * @param userId    The user to evaluate.
 * @param eventType A logical event identifier, e.g. "feedback.escalated".
 * @param severity  Numeric severity of the event (1-5).
 * @returns true if the user should be notified, false otherwise.
 */
export async function shouldNotifyUser(
  userId: string,
  eventType: string,
  severity: number
): Promise<boolean> {
  const prefs = await getNotificationPrefs(userId);

  // No enabled channel means the user has opted out of all notifications.
  if (!prefs.emailEnabled && !prefs.slackEnabled) return false;

  // Severity threshold check: only notify when the event is severe enough.
  if (severity < prefs.minSeverity) return false;

  return true;
}
