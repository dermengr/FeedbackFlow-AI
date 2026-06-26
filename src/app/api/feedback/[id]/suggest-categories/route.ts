import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  suggestCategories,
  FeedbackItemNotFoundError,
} from "@/lib/smart-categorization";

// POST /api/feedback/:id/suggest-categories - use the local LLM to suggest
// custom category labels for a feedback item. Requires authentication.
export async function POST(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const suggestions = await suggestCategories(params.id);
    return NextResponse.json(suggestions);
  } catch (err) {
    if (err instanceof FeedbackItemNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[suggest-categories] failed:", err);
    return NextResponse.json(
      { error: "Failed to suggest categories" },
      { status: 500 }
    );
  }
}
