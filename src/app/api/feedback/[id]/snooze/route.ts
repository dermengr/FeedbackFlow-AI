import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { snoozeFeedback, unsnoozeFeedback } from "@/lib/snooze";

const SnoozeSchema = z.object({
  until: z.string().datetime(),
});

// POST /api/feedback/:id/snooze - snooze a feedback item until a future date.
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

  const parsed = SnoozeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const until = new Date(parsed.data.until);
  if (until.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Snooze date must be in the future" },
      { status: 400 }
    );
  }

  await snoozeFeedback(params.id, until);

  return NextResponse.json({ ok: true, snoozedUntil: parsed.data.until });
}

// DELETE /api/feedback/:id/snooze - manually unsnooze a feedback item.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await unsnoozeFeedback(params.id);

  return NextResponse.json({ ok: true });
}
