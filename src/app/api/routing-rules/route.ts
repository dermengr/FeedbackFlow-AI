import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  listRoutingRules,
  createRoutingRule,
} from "@/lib/routing";

// GET /api/routing-rules — list all routing rules with their assignee
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ROUTING_READ);
  if (forbidden) return forbidden;
  const rules = await listRoutingRules();
  return NextResponse.json({ rules });
}

const ConditionsSchema = z
  .object({
    topics: z.array(z.string().min(1)).optional(),
    minSeverity: z.number().int().min(1).max(5).optional(),
    sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
  })
  .strict();

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  conditions: ConditionsSchema,
  assigneeId: z.string().min(1),
  priority: z.number().int().min(0).optional(),
});

// POST /api/routing-rules — create a new routing rule
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_ROUTING_WRITE);
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
    const created = await createRoutingRule(parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create routing rule", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
