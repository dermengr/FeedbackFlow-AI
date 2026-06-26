import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { detectEmergingTrends } from "@/lib/emerging-trends";

// GET /api/trends/emerging?windowDays=7
// Returns topic frequency trends comparing the recent window vs the previous
// equal-length window. Auth required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("windowDays");
  const parsed = raw ? Number(raw) : NaN;
  const windowDays =
    Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 7;

  const trends = await detectEmergingTrends(windowDays);
  return NextResponse.json({ trends });
}
