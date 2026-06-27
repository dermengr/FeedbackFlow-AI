import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import {
  translateFeedback,
  FeedbackItemNotFoundError,
} from "@/lib/translation";
import { DEFAULT_LOCALE, isSupportedLanguage } from "@/lib/i18n/languages";

const BodySchema = z.object({
  targetLanguage: z.string().min(2).max(5).optional(),
});

// POST /api/feedback/:id/translate — AI-translate feedback to a target language.
export async function POST(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_TRANSLATE_WRITE);
  if (forbidden) return forbidden;

  let targetLanguage = DEFAULT_LOCALE;
  try {
    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (parsed.success && parsed.data.targetLanguage) {
      targetLanguage = parsed.data.targetLanguage.trim().toLowerCase();
    }
  } catch {
    // Empty body defaults to English.
  }

  if (!isSupportedLanguage(targetLanguage)) {
    return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
  }

  try {
    const result = await translateFeedback(params.id, targetLanguage);
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
