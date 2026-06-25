import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { LABEL_COLORS, listLabels, createLabel } from "@/lib/labels";

// GET /api/labels — list all labels in the taxonomy
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const labels = await listLabels();
  return NextResponse.json({ labels });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.enum(LABEL_COLORS).optional().default("slate"),
});

// POST /api/labels — create a new label
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    const created = await createLabel(parsed.data.name, parsed.data.color);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create label", detail: (err as Error).message },
      { status: 409 }
    );
  }
}
