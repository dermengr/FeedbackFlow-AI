import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { computeTopicTrends } from "@/lib/trends";

// GET /api/trends - week-over-week rising/falling topic trends.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trends = await computeTopicTrends();
  return NextResponse.json({ trends });
}
