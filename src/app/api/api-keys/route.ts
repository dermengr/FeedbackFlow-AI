import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { listApiKeys, createApiKey, ALLOWED_SCOPES } from "@/lib/api-keys";

// GET /api/api-keys — list the current user's API keys (without hashes)
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_API_KEYS_READ);
  if (forbidden) return forbidden;
  const keys = await listApiKeys(auth.userId);
  return NextResponse.json({ keys });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(z.enum(ALLOWED_SCOPES))
    .max(ALLOWED_SCOPES.length)
    .default([]),
});

// POST /api/api-keys — create a new API key for the current user.
// The raw key is returned in the response exactly once and is never stored.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_API_KEYS_WRITE);
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
    const key = await createApiKey(auth.userId, {
      name: parsed.data.name,
      scopes: parsed.data.scopes,
    });
    return NextResponse.json({ key }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create API key", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
