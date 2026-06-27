import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  ONBOARDING_STEPS,
  getOnboardingState,
  getOnboardingProgress,
  completeStep,
  skipOnboarding,
} from "@/lib/onboarding";

// GET /api/onboarding — return the user's onboarding state and progress.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_NOTIFICATIONS_WRITE);
  if (forbidden) return forbidden;
  const userId = auth.userId;
  const [state, progress] = await Promise.all([
    getOnboardingState(userId),
    getOnboardingProgress(userId),
  ]);
  return NextResponse.json({ state, progress });
}

const VALID_STEP_IDS = ONBOARDING_STEPS.map((s) => s.id) as [string, ...string[]];

const CompleteSchema = z.object({
  stepId: z.enum(VALID_STEP_IDS),
});

// POST /api/onboarding — mark a step as completed.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_NOTIFICATIONS_WRITE);
  if (forbidden) return forbidden;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const state = await completeStep(auth.userId, parsed.data.stepId);
  const progress = await getOnboardingProgress(auth.userId);
  return NextResponse.json({ state, progress });
}

// DELETE /api/onboarding — skip onboarding for the current user.
export async function DELETE(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_NOTIFICATIONS_WRITE);
  if (forbidden) return forbidden;
  const state = await skipOnboarding(auth.userId);
  const progress = await getOnboardingProgress(auth.userId);
  return NextResponse.json({ state, progress });
}
