import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { computeTopicTrends } from "@/lib/trends";

// GET /api/trends - week-over-week rising/falling topic trends.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_TRENDS_READ);
  if (forbidden) return forbidden;

  const trends = await computeTopicTrends();
  return NextResponse.json({ trends });
}
