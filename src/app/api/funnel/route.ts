import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { getFunnelData } from "@/lib/funnel";

// GET /api/funnel?days=30 - triage funnel counts by status with conversion rates.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 30;

  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json(
      { error: "days must be a positive number" },
      { status: 400 }
    );
  }

  const funnel = await getFunnelData(days);
  return NextResponse.json(funnel);
}
