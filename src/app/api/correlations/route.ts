import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { getTopicCorrelations } from "@/lib/correlations";

// GET /api/correlations?days=30 - returns topic co-occurrence correlations
// for feedback analyzed within the last `days` days, sorted by count
// descending. Default window is 30 days. Auth required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_CORRELATIONS_READ);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const rawDays = searchParams.get("days");
  let days = 30;
  if (rawDays !== null) {
    const parsed = Number(rawDays);
    if (Number.isFinite(parsed) && parsed > 0) {
      days = Math.floor(parsed);
    }
  }

  const correlations = await getTopicCorrelations(days);
  return NextResponse.json({ correlations, days });
}
