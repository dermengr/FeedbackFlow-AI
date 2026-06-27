import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  getSuggestions,
  recordSearch,
} from "@/lib/search-suggestions";

// GET /api/search/suggestions?q=<partial>
// Returns autocomplete suggestions derived from the user's search history and
// popular feedback topics. Auth required.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SEARCH_READ);
  if (forbidden) return forbidden;

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const suggestions = await getSuggestions(userId, q);

  return NextResponse.json(suggestions);
}

// POST /api/search/suggestions
// Body: { query: string, resultsCount?: number }
// Records a completed search to the user's SearchHistory. Auth required.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_SEARCH_READ);
  if (forbidden) return forbidden;

  const userId = auth.userId;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, resultsCount } = (body ?? {}) as {
    query?: string;
    resultsCount?: number;
  };

  if (typeof query !== "string" || !query.trim()) {
    return NextResponse.json(
      { error: "query is required" },
      { status: 400 }
    );
  }

  await recordSearch(userId, query, typeof resultsCount === "number" ? resultsCount : 0);

  return NextResponse.json({ ok: true });
}
