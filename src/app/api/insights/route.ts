import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  generateInsights,
  getFreshCachedInsights,
  normalizeTimeRange,
  type InsightsTimeRange,
} from "@/lib/insights";

// GET /api/insights?timeRange=7d|30d|all
// Returns an AI-generated insights summary for the requested time range.
// If a fresh (< 1 hour old) cached insight exists it is returned immediately;
// otherwise a new one is generated (and cached).
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_INSIGHTS_READ);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const timeRange: InsightsTimeRange = normalizeTimeRange(
    url.searchParams.get("timeRange")
  );

  // Cache hit: return fresh cached insights without invoking the LLM.
  const cached = await getFreshCachedInsights(timeRange);
  if (cached) {
    return NextResponse.json({ timeRange, cached: true, insights: cached });
  }

  // Cache miss / stale: generate a fresh summary.
  try {
    const insights = await generateInsights(timeRange);
    return NextResponse.json({ timeRange, cached: false, insights });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
