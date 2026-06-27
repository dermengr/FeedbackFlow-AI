import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";

// GET /api/sources — list all source configs
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SOURCES_READ);
  if (forbidden) return forbidden;
  const sources = await prisma.sourceConfig.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { ingestLogs: true } },
    },
  });
  return NextResponse.json({ sources });
}

const CreateSchema = z.object({
  sourceKey: z.string().min(1),
  label: z.string().min(1),
  adapter: z.enum(["github", "reddit", "rss", "csv"]),
  config: z.record(z.unknown()),
  enabled: z.boolean().optional().default(true),
});

// POST /api/sources — create a new source config
export async function POST(req: Request) {
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
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  try {
    const created = await prisma.sourceConfig.create({
      data: {
        sourceKey: parsed.data.sourceKey,
        label: parsed.data.label,
        adapter: parsed.data.adapter,
        config: parsed.data.config as never,
        enabled: parsed.data.enabled,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create source", detail: (err as Error).message },
      { status: 409 }
    );
  }
}
