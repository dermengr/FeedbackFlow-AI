import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { listTemplates, createTemplate, searchTemplates } from "@/lib/reply-templates";

// GET /api/reply_templates — list the current user's reply templates. Pass
// ?query= to filter by name/body/tags substring.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_REPLY_TEMPLATES_READ);
  if (forbidden) return forbidden;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query") ?? "";

  try {
    const templates =
      query.trim() === ""
        ? await listTemplates(auth.userId)
        : await searchTemplates(auth.userId, query);
    return NextResponse.json({ templates });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load templates", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().max(200).optional(),
  body: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

// POST /api/reply_templates — create a new reply template for the current user.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_REPLY_TEMPLATES_WRITE);
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
    const created = await createTemplate(auth.userId, parsed.data);
    return NextResponse.json({ template: created }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create template", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
