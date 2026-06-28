import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { PERMISSIONS } from "@/lib/roles";
import {
  recordSearch,
  getSearchHistory,
  clearSearchHistory,
} from "@/lib/search-history";

const QuerySchema = z.object({
  query: z.string().min(1),
  resultsCount: z.number().int().min(0).optional(),
});

// GET /api/search/history - list the current user's search history.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.API_SEARCH_READ);
  if (forbidden) return forbidden;

  const url = new URL(req.url);
  const limit = Math.max(
    1,
    Math.min(100, Number(url.searchParams.get("limit") ?? 20) || 20)
  );

  try {
    const history = await getSearchHistory(auth.userId, limit);
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load search history", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/search/history - record a search query.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.API_SEARCH_READ);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const entry = await recordSearch(
      auth.userId,
      parsed.data.query,
      parsed.data.resultsCount
    );
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to record search", detail: (err as Error).message },
      { status: 400 }
    );
  }
}

// DELETE /api/search/history - clear the current user's search history.
export async function DELETE() {
  const auth = await getRequestAuth();
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.API_SEARCH_READ);
  if (forbidden) return forbidden;

  try {
    await clearSearchHistory(auth.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to clear search history", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
