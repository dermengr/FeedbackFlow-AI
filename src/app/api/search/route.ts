import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { searchFeedback } from "@/lib/search";

// GET /api/search - full-text search over feedback items.
// Query params:
//   q        (required) full-text search query
//   page     (default 1)
//   pageSize (default 20, max 100)
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20)
  );

  // Empty query: return empty results without hitting the DB.
  if (!q.trim()) {
    return NextResponse.json({ results: [], total: 0, page, pageSize });
  }

  const { results, total } = await searchFeedback(q, page, pageSize);

  return NextResponse.json({ results, total, page, pageSize });
}
