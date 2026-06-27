import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { isSlackEnabled, sendSlackMessage } from "@/lib/slack";

// GET /api/webhook/slack - report whether Slack notifications are configured.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WEBHOOKS_WRITE);
  if (forbidden) return forbidden;
  return NextResponse.json({ enabled: isSlackEnabled() });
}

// POST /api/webhook/slack - send a test message to the configured Slack webhook.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WEBHOOKS_WRITE);
  if (forbidden) return forbidden;
  if (!isSlackEnabled()) {
    return NextResponse.json(
      { error: "SLACK_WEBHOOK_URL is not configured" },
      { status: 400 }
    );
  }
  try {
    await sendSlackMessage({
      text: ":white_check_mark: FeedbackFlow AI: Slack webhook test successful.",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Slack test failed", message: (err as Error).message },
      { status: 502 }
    );
  }
}
