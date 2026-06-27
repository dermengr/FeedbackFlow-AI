import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  EXPORT_FORMATS,
  listTemplates,
  createTemplate,
} from "@/lib/export-templates";

// GET /api/export/templates — list export templates for the current user
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_EXPORT_READ);
  if (forbidden) return forbidden;
  const templates = await listTemplates(auth.userId);
  return NextResponse.json({ templates });
}

const ColumnSchema = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
});

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  columns: z.array(ColumnSchema).min(1),
  format: z.enum(EXPORT_FORMATS as unknown as [string, ...string[]]).optional(),
  filterQuery: z.string().nullable().optional(),
});

// POST /api/export/templates — create a new export template
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_EXPORT_WRITE);
  if (forbidden) return forbidden;
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
    const created = await createTemplate(auth.userId, {
      name: parsed.data.name,
      columns: parsed.data.columns,
      format: parsed.data.format as "csv" | "json" | "tsv" | undefined,
      filterQuery: parsed.data.filterQuery,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create template", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
