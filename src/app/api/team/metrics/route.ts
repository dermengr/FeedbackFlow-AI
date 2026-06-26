import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  getTeamMetrics,
  snapshotTeamMetrics,
  type MetricsPeriod,
} from "@/lib/team-metrics";

const VALID_PERIODS: MetricsPeriod[] = ["daily", "weekly", "monthly"];

// GET /api/team/metrics?period=weekly — per-team-member triage performance.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period") ?? "weekly";
  const period = VALID_PERIODS.includes(periodParam as MetricsPeriod)
    ? (periodParam as MetricsPeriod)
    : "weekly";

  const metrics = await getTeamMetrics(period);
  return NextResponse.json({ period, metrics });
}

// POST /api/team/metrics — snapshot the current period's metrics into the
// TeamMetric table for historical tracking.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get("period") ?? "weekly";
  const period = VALID_PERIODS.includes(periodParam as MetricsPeriod)
    ? (periodParam as MetricsPeriod)
    : "weekly";

  try {
    await snapshotTeamMetrics(period);
    return NextResponse.json({ ok: true, period });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to snapshot metrics", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
