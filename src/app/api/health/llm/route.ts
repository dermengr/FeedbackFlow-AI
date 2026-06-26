import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { checkLlmHealth } from "@/lib/llm-health";

// GET /api/health/llm — verify the configured LLM is reachable and responding.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const health = await checkLlmHealth();
    const statusCode = health.status === "down" ? 503 : 200;
    return NextResponse.json(health, {
      status: statusCode,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "down",
        detail: (err as Error).message,
        checkedAt: new Date().toISOString(),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}