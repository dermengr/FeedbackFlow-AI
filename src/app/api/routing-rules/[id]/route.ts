import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRequestAuth,
  unauthorizedResponse,
} from "@/lib/request-auth";
import {
  updateRoutingRule,
  deleteRoutingRule,
} from "@/lib/routing";

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).optional(),
  assigneeId: z.string().min(1).optional(),
  conditions: z
    .object({
      topics: z.array(z.string().min(1)).optional(),
      minSeverity: z.number().int().min(1).max(5).optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    })
    .strict()
    .optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

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
    const updated = await updateRoutingRule(params.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update routing rule", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    await deleteRoutingRule(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to delete routing rule", detail: (err as Error).message },
      { status: 500 }
    );
  }
}