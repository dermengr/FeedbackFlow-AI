import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { PERMISSIONS } from "@/lib/roles";
import { triggerWebhook } from "@/lib/webhooks";

// POST /api/webhooks/:id/test - send a test ping to a configured webhook.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.API_WEBHOOKS_WRITE);
  if (forbidden) return forbidden;

  const result = await triggerWebhook(params.id, "feedback.new", {
    test: true,
    message: "This is a test ping from FeedbackFlow AI webhook logs.",
  });

  if (!result.success) {
    return NextResponse.json(
      { error: "Webhook test failed", statusCode: result.statusCode },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, statusCode: result.statusCode });
}
