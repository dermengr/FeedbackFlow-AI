import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  EXPORT_FORMATS,
  updateTemplate,
  deleteTemplate,
} from "@/lib/export-templates";
import { prisma } from "@/lib/prisma";

// GET /api/export/templates/:id — fetch a single export template. Verifies
// ownership when the template has a userId set.
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const template = await prisma.exportTemplate.findUnique({
    where: { id: params.id },
  });
  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Verify ownership when the template is owned by a user.
  if (template.userId && template.userId !== auth.userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(template);
}

const ColumnSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
});

const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  columns: z.array(ColumnSchema).min(1).optional(),
  format: z
    .enum(EXPORT_FORMATS as unknown as [string, ...string[]])
    .optional(),
  filterQuery: z.string().nullable().optional(),
});

// PATCH /api/export/templates/:id — update an export template (owner only)
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
    const updated = await updateTemplate(params.id, auth.userId, {
      name: parsed.data.name,
      columns: parsed.data.columns,
      format: parsed.data.format as "csv" | "json" | "tsv" | undefined,
      filterQuery: parsed.data.filterQuery,
    });
    return NextResponse.json(updated);
  } catch {
    // Template not found or not owned by the caller — both map to 404 to
    // avoid leaking the existence of other users' templates.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

// DELETE /api/export/templates/:id — remove an export template (owner only)
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  try {
    await deleteTemplate(params.id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
