import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { archiveItem, unarchiveItem } from "@/lib/archive";

const ArchiveSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

// POST /api/feedback/:id/archive - archive a feedback item.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ArchiveSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const archive = await archiveItem(params.id, userId, parsed.data.reason);
    return NextResponse.json(archive, { status: 201 });
  } catch {
    // archiveItem throws when an archive record already exists.
    return NextResponse.json(
      { error: "Feedback item is already archived" },
      { status: 409 }
    );
  }
}

// DELETE /api/feedback/:id/archive - unarchive a feedback item.
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await unarchiveItem(params.id);

  return NextResponse.json({ ok: true });
}
