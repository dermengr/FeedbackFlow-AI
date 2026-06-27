import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { translateText, translateTexts } from "@/lib/app-translation";
import { isSupportedLanguage } from "@/lib/i18n/languages";

const SingleSchema = z.object({
  text: z.string().min(1).max(8000),
  targetLanguage: z.string().min(2).max(5),
  sourceLanguage: z.string().min(2).max(5).optional(),
});

const BatchSchema = z.object({
  texts: z.array(z.string().min(1).max(4000)).min(1).max(20),
  targetLanguage: z.string().min(2).max(5),
  sourceLanguage: z.string().min(2).max(5).optional(),
});

// POST /api/translate — AI-translate text to a target language.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_TRANSLATE_WRITE);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const batch = BatchSchema.safeParse(body);
  if (batch.success) {
    if (!isSupportedLanguage(batch.data.targetLanguage)) {
      return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
    }
    try {
      const results = await translateTexts(
        batch.data.texts,
        batch.data.targetLanguage,
        batch.data.sourceLanguage
      );
      return NextResponse.json({ results });
    } catch (err) {
      return NextResponse.json(
        { error: "Translation failed", detail: (err as Error).message },
        { status: 500 }
      );
    }
  }

  const single = SingleSchema.safeParse(body);
  if (!single.success) {
    return NextResponse.json(
      { error: "Invalid input", details: single.error.flatten() },
      { status: 400 }
    );
  }

  if (!isSupportedLanguage(single.data.targetLanguage)) {
    return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
  }

  try {
    const result = await translateText(
      single.data.text,
      single.data.targetLanguage,
      single.data.sourceLanguage
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Translation failed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}