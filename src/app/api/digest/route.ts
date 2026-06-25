import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runDigest, isDigestEnabled } from "@/lib/digest";

// GET /api/digest - report whether the email digest is configured.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: isDigestEnabled() });
}

// POST /api/digest - manually trigger a digest email (protected).
// Useful for testing / demos without waiting for the daily cron.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDigest();
    const status =
      result.status === "FAILURE" ? 500 : result.status === "DISABLED" ? 200 : 200;
    return NextResponse.json(result, { status });
  } catch (err) {
    return NextResponse.json(
      { error: "Digest failed", message: (err as Error).message },
      { status: 500 }
    );
  }
}
