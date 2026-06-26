import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import { generateReply, FeedbackItemNotFoundError } from "@/lib/reply-gen";

// POST /api/feedback/:id/reply - generate a suggested support reply for a
// feedback item using the local LLM. Requires authentication.
export async function POST(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  try {
    const reply = await generateReply(params.id);
    return NextResponse.json({ reply });
  } catch (err) {
    if (err instanceof FeedbackItemNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[reply] generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate reply" },
      { status: 500 }
    );
  }
}
