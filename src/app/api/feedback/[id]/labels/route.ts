import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/feedback/:id/labels - labels assigned to this feedback item
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const feedbackLabels = await prisma.feedbackLabel.findMany({
    where: { feedbackItemId: params.id },
    include: { label: true },
  });

  const labels = feedbackLabels.map((fl) => ({
    id: fl.label.id,
    name: fl.label.name,
    color: fl.label.color,
  }));

  return NextResponse.json({ labels });
}

const LabelSchema = z.object({
  labelId: z.string().min(1),
});

// POST /api/feedback/:id/labels - assign a label to this feedback item
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = LabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { labelId } = parsed.data;

  const label = await prisma.label.findUnique({
    where: { id: labelId },
  });
  if (!label) {
    return NextResponse.json({ error: "Label not found" }, { status: 404 });
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.feedbackLabel.create({
      data: {
        feedbackItemId: params.id,
        labelId,
      },
    });
  } catch (err: unknown) {
    // Prisma unique-constraint violation: label already assigned.
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Label already assigned to this item" },
        { status: 409 }
      );
    }
    throw err;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// DELETE /api/feedback/:id/labels - remove a label from this feedback item
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let labelId: string | undefined;

  // Prefer a JSON body, fall back to a query param.
  try {
    const body = await req.json();
    const parsed = LabelSchema.safeParse(body);
    if (parsed.success) {
      labelId = parsed.data.labelId;
    }
  } catch {
    // Body wasn't JSON; fall through to query param.
  }

  if (!labelId) {
    const url = new URL(req.url);
    labelId = url.searchParams.get("labelId") ?? undefined;
  }

  if (!labelId) {
    return NextResponse.json(
      { error: "labelId is required" },
      { status: 400 }
    );
  }

  await prisma.feedbackLabel.delete({
    where: {
      feedbackItemId_labelId: {
        feedbackItemId: params.id,
        labelId,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
