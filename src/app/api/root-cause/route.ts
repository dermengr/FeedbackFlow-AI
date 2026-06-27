import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  analyzeRootCause,
  validateRootCauseItemIds,
} from "@/lib/root-cause";

// POST /api/root-cause
// Body: { feedbackItemIds: string[] }
// Analyzes a group of related feedback items to identify root causes,
// recurring patterns, and recommended actions via the local LLM.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ROOT_CAUSE_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawIds = (body as { feedbackItemIds?: unknown })?.feedbackItemIds;
  const validation = validateRootCauseItemIds(rawIds);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await analyzeRootCause(validation.ids);
    return NextResponse.json({ analysis: result });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to analyze root causes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
