import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { detectAnomalies } from "@/lib/anomaly";

// GET /api/anomalies?days=30 - returns detected volume and sentiment anomalies
// for the requested window. Default window is 30 days. Auth required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const rawDays = searchParams.get("days");
  let days = 30;
  if (rawDays !== null) {
    const parsed = Number(rawDays);
    if (Number.isFinite(parsed) && parsed > 0) {
      days = Math.floor(parsed);
    }
  }

  try {
    const data = await detectAnomalies(days);
    return NextResponse.json({ ...data, days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to detect anomalies";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
