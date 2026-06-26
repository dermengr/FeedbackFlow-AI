import { NextResponse } from "next/server";
import { z } from "zod";
import { translateUiMessages } from "@/lib/app-translation";
import { isSupportedLanguage } from "@/lib/i18n/languages";
import { MESSAGE_KEYS, type MessageKey } from "@/lib/i18n/messages/en";

const BodySchema = z.object({
  targetLanguage: z.string().min(2).max(5),
  keys: z.array(z.string()).optional(),
});

// POST /api/translate/ui — AI-translate the app UI message catalog.
// Public endpoint — translates only the static UI message catalog (no user data).
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const target = parsed.data.targetLanguage.trim().toLowerCase();
  if (!isSupportedLanguage(target)) {
    return NextResponse.json({ error: "Unsupported target language" }, { status: 400 });
  }

  const keys = parsed.data.keys?.filter((k): k is MessageKey =>
    (MESSAGE_KEYS as string[]).includes(k)
  );

  try {
    const messages = await translateUiMessages(target, keys);
    return NextResponse.json({ targetLanguage: target, messages });
  } catch (err) {
    return NextResponse.json(
      { error: "UI translation failed", detail: (err as Error).message },
      { status: 500 }
    );
  }
}