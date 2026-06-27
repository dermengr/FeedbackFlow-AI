import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { getHeatmapData } from "@/lib/heatmap";

// GET /api/heatmap?days=7 - returns a 7x24 sentiment heatmap grid (day-of-week
// x hour-of-day) for feedback submitted within the last `days` days.
// Default window is 30 days. Auth required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_HEATMAP_READ);
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

  const grid = await getHeatmapData(days);
  return NextResponse.json({ grid, days });
}
