import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { updateTemplate, deleteTemplate } from "@/lib/reply-templates";

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().max(200).nullable().optional(),
  body: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
});

// PATCH /api/reply_templates/:id — update a template owned by the current user.
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_REPLY_TEMPLATES_WRITE);
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
    const template = await updateTemplate(
      params.id,
      auth.userId,
      parsed.data
    );
    return NextResponse.json({ template });
  } catch {
    // Template not found or not owned by the caller — both map to 404 to avoid
    // leaking the existence of other users' templates.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// DELETE /api/reply_templates/:id — remove a template owned by the current user.
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_REPLY_TEMPLATES_WRITE);
  if (forbidden) return forbidden;

  try {
    await deleteTemplate(params.id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
