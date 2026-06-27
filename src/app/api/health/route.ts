import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { getHealthStatus } from "@/lib/health";

// GET /api/health — system health (ingestion + processing). Auth required.
// Never cached: health status must always reflect the latest state.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_HEALTH_READ);
  if (forbidden) return forbidden;

  try {
    const health = await getHealthStatus();
    return NextResponse.json(health, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to compute health", detail: (err as Error).message },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
