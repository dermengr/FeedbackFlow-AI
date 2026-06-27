import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { updateWidget, deleteWidget } from "@/lib/widgets";

const UpdateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  positionX: z.number().int().min(0).optional(),
  positionY: z.number().int().min(0).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
});

// PATCH /api/widgets/:id — update a widget's position/config/title. Verifies
// ownership before applying the update.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WIDGETS_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const widget = await updateWidget(params.id, auth.userId, parsed.data);
    return NextResponse.json({ widget });
  } catch {
    // Widget not found or not owned by the caller — both map to 404 to avoid
    // leaking the existence of other users' widgets.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// DELETE /api/widgets/:id — remove a widget owned by the current user.
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WIDGETS_WRITE);
  if (forbidden) return forbidden;

  try {
    await deleteWidget(params.id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
