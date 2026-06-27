import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/roles";
import { z } from "zod";
import { 
  getRequestAuth,
  unauthorizedResponse,
 requirePermission, } from "@/lib/request-auth";
import {
  updateWebhook,
  deleteWebhook,
  VALID_EVENTS,
} from "@/lib/webhooks";

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(VALID_EVENTS)).min(1).optional(),
  secret: z.string().nullable().optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WEBHOOKS_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const updated = await updateWebhook(params.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update webhook", detail: (err as Error).message },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WEBHOOKS_WRITE);
  if (forbidden) return forbidden;

  try {
    await deleteWebhook(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete webhook", detail: (err as Error).message },
      { status: 500 }
    );
  }
}