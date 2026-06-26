import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  translateFeedback,
  FeedbackItemNotFoundError,
} from "@/lib/translation";

// POST /api/feedback/:id/translate - translate a non-English feedback item to
// English using the local LLM. Requires authentication.
export async function POST(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const result = await translateFeedback(params.id);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FeedbackItemNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[translate] translation failed:", err);
    return NextResponse.json(
      { error: "Failed to translate feedback" },
      { status: 500 }
    );
  }
}
