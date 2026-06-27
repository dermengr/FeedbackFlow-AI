import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { getRealtimeStats } from "@/lib/realtime-stats";

// GET /api/stats/realtime - live dashboard activity stats.
// Auth required. Never cached: Cache-Control: no-store.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_REALTIME_STATS_READ);
  if (forbidden) return forbidden;

  const stats = await getRealtimeStats();

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
