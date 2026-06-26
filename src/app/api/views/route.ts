import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { listViews, createView } from "@/lib/views";

// GET /api/views — list the current user's saved views
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const views = await listViews(auth.userId);
  return NextResponse.json({ views });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  query: z.string().min(1).max(2000),
});

// POST /api/views — create a new saved view for the current user
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
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
    const view = await createView(
      auth.userId,
      parsed.data.name,
      parsed.data.query
    );
    return NextResponse.json({ view }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create view", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
