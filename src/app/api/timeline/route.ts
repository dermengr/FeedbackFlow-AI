import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { getTimelineData } from "@/lib/timeline";

// GET /api/timeline?days=30&source=GitHubIssues - returns a per-day timeline of
// feedback activity (total + per-sentiment counts) for the last `days` days,
// optionally filtered to a single source. Default window is 30 days. Auth
// required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);

  let days = 30;
  const rawDays = searchParams.get("days");
  if (rawDays !== null) {
    const parsed = Number(rawDays);
    if (Number.isFinite(parsed) && parsed > 0) {
      days = Math.floor(parsed);
    }
  }

  const source = searchParams.get("source") ?? undefined;

  const data = await getTimelineData(days, source);
  // `data.days` is the array of per-day buckets; expose the requested window
  // size separately as `windowDays` so the array key is not clobbered.
  return NextResponse.json({ ...data, windowDays: days });
}
