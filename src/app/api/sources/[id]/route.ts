import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";

// GET /api/sources/:id — single source config
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SOURCES_READ);
  if (forbidden) return forbidden;
  const source = await prisma.sourceConfig.findUnique({
    where: { id: params.id },
  });
  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(source);
}

const PatchSchema = z.object({
  label: z.string().min(1).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

// PATCH /api/sources/:id — update source config
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SOURCES_WRITE);
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
  const updated = await prisma.sourceConfig.update({
    where: { id: params.id },
    data: {
      ...(parsed.data.label !== undefined && { label: parsed.data.label }),
      ...(parsed.data.config !== undefined && { config: parsed.data.config as never }),
      ...(parsed.data.enabled !== undefined && { enabled: parsed.data.enabled }),
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/sources/:id — remove source config
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SOURCES_WRITE);
  if (forbidden) return forbidden;
  await prisma.sourceConfig.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
