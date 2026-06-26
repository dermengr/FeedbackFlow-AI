import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  listWebhooks,
  createWebhook,
  VALID_EVENTS,
} from "@/lib/webhooks";

// GET /api/webhooks — list all outgoing webhook configs.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const webhooks = await listWebhooks();
  return NextResponse.json({ webhooks });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z
    .array(z.enum(VALID_EVENTS))
    .min(1, "At least one event is required"),
  secret: z.string().optional(),
});

// POST /api/webhooks — create a new outgoing webhook config.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const created = await createWebhook({
      name: parsed.data.name,
      url: parsed.data.url,
      events: parsed.data.events,
      secret: parsed.data.secret,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create webhook", detail: (err as Error).message },
      { status: 400 }
    );
  }
}
