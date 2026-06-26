import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from "@/lib/notifications";

// GET /api/notifications — return the current user's notification preferences.
// Creates a default preferences row on first access if none exists yet.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const prefs = await getNotificationPrefs(auth.userId);
    return NextResponse.json({ prefs });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load preferences", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// Validation schema for partial preference updates. All fields optional so
// callers can patch a single setting without resending the whole object.
const UpdateSchema = z.object({
  emailEnabled: z.boolean().optional(),
  slackEnabled: z.boolean().optional(),
  minSeverity: z.number().int().min(1).max(5).optional(),
  digestFrequency: z
    .enum(["daily", "weekly", "monthly", "never"])
    .optional(),
});

// PATCH /api/notifications — update the current user's notification preferences.
export async function PATCH(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const prefs = await updateNotificationPrefs(auth.userId, parsed.data);
    return NextResponse.json({ prefs });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update preferences", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
