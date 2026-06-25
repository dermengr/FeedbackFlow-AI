import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { executeBulk } from "@/lib/bulk";

const BulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(500),
  action: z.enum(["status", "assign", "label", "delete"]),
  value: z.string(),
});

// POST /api/feedback/bulk - apply an action to multiple feedback items at once.
export async function POST(req: Request) {
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

  const parsed = BulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await executeBulk(parsed.data);
  return NextResponse.json(result);
}
