import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runIngest } from "@/lib/ingest";

// POST /api/ingest - manually trigger an ingest run (protected).
// Useful for testing / demos without waiting for the daily cron.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runIngest();
    const status =
      result.status === "FAILURE" ? 500 : result.status === "PARTIAL" ? 207 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { error: "Ingest failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}
