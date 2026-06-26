import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { runDigest, isDigestEnabled } from "@/lib/digest";

// GET /api/digest - report whether the email digest is configured.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  return NextResponse.json({ enabled: isDigestEnabled() });
}

// POST /api/digest - manually trigger a digest email (protected).
// Useful for testing / demos without waiting for the daily cron.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

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
