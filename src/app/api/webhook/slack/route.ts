import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSlackEnabled, sendSlackMessage } from "@/lib/slack";

// GET /api/webhook/slack - report whether Slack notifications are configured.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ enabled: isSlackEnabled() });
}

// POST /api/webhook/slack - send a test message to the configured Slack webhook.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
