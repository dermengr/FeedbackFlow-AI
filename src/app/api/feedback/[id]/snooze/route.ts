import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { snoozeFeedback, unsnoozeFeedback } from "@/lib/snooze";

const SnoozeSchema = z.object({
  until: z.string().datetime(),
});

// POST /api/feedback/:id/snooze - snooze a feedback item until a future date.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

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
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  await unsnoozeFeedback(params.id);

  return NextResponse.json({ ok: true });
}
