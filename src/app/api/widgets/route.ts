import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  listWidgets,
  createWidget,
  getWidgetData,
  WIDGET_TYPES,
} from "@/lib/widgets";

// GET /api/widgets — list the current user's widgets, each enriched with its
// aggregated data payload (dispatched on widget.type).
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WIDGETS_READ);
  if (forbidden) return forbidden;

  const widgets = await listWidgets(auth.userId);

  // Fetch the data payload for each widget in parallel.
  const enriched = await Promise.all(
    widgets.map(async (w) => {
      const { data } = await getWidgetData({ type: w.type, config: w.config });
      return { ...w, data };
    })
  );

  return NextResponse.json({ widgets: enriched });
}

const CreateSchema = z.object({
  type: z.enum(WIDGET_TYPES as unknown as [string, ...string[]]),
  title: z.string().min(1).max(100),
  config: z.record(z.unknown()).optional(),
  positionX: z.number().int().min(0).optional(),
  positionY: z.number().int().min(0).optional(),
  width: z.number().int().min(1).optional(),
  height: z.number().int().min(1).optional(),
});

// POST /api/widgets — create a new widget for the current user.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_WIDGETS_WRITE);
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
    const widget = await createWidget(auth.userId, parsed.data);
    return NextResponse.json({ widget }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to create widget", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
