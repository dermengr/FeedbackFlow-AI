import { chatJson } from "@/lib/llm";
import { isSupportedLanguage, DEFAULT_LOCALE } from "@/lib/i18n/languages";
import { enMessages, type MessageKey } from "@/lib/i18n/messages/en";

export interface TextTranslationResult {
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: number;
}

function buildTextPrompt(targetLanguage: string, sourceLanguage?: string): string {
  const target = targetLanguage.toUpperCase();
  const sourceHint = sourceLanguage
    ? `from ${sourceLanguage.toUpperCase()} `
    : "";
  return `You are a professional translator. Translate the user text ${sourceHint}to ${target} (${targetLanguage}).
Return STRICT JSON only: {"translatedText": string, "detectedLanguage": string (ISO 639-1 source code), "confidence": number (0-1)}.
Preserve meaning, tone, and technical terms. Do not add commentary.`;
}

function buildBatchUiPrompt(targetLanguage: string): string {
  return `You are a professional UI translator. Translate every string value in the input JSON object to ${targetLanguage} (${targetLanguage.toUpperCase()}).
Keep JSON keys exactly unchanged. Return STRICT JSON only with the same keys and translated string values.
Use concise, natural UI phrasing suitable for a SaaS dashboard.`;
}

function wrapUntrustedText(text: string): string {
  const truncated = text.slice(0, 4000);
  return `<text>\n${truncated}\n</text>`;
}

/** Translate a single text snippet to a target language via the configured LLM. */
export async function translateText(
  text: string,
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TextTranslationResult> {
  const target = targetLanguage.trim().toLowerCase();
  if (!isSupportedLanguage(target)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }
  if (!text.trim()) {
    return {
      translatedText: "",
      detectedLanguage: sourceLanguage ?? DEFAULT_LOCALE,
      targetLanguage: target,
      confidence: 1,
    };
  }
  if (target === DEFAULT_LOCALE && !sourceLanguage) {
    return {
      translatedText: text,
      detectedLanguage: DEFAULT_LOCALE,
      targetLanguage: target,
      confidence: 1,
    };
  }

  const result = await chatJson<{
    translatedText?: string;
    detectedLanguage?: string;
    confidence?: number;
  }>(buildTextPrompt(target, sourceLanguage), wrapUntrustedText(text), {
    temperature: 0.1,
  });

  return {
    translatedText:
      typeof result.translatedText === "string" ? result.translatedText : text,
    detectedLanguage:
      typeof result.detectedLanguage === "string"
        ? result.detectedLanguage
        : sourceLanguage ?? DEFAULT_LOCALE,
    targetLanguage: target,
    confidence:
      typeof result.confidence === "number" && !Number.isNaN(result.confidence)
        ? result.confidence
        : 0.8,
  };
}

/** Translate multiple UI message keys in one LLM call. */
export async function translateUiMessages(
  targetLanguage: string,
  keys?: MessageKey[]
): Promise<Record<string, string>> {
  const target = targetLanguage.trim().toLowerCase();
  if (!isSupportedLanguage(target)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }
  if (target === DEFAULT_LOCALE) {
    return { ...enMessages };
  }

  const subset = keys?.length
    ? Object.fromEntries(keys.map((k) => [k, enMessages[k]]))
    : { ...enMessages };

  const result = await chatJson<Record<string, string>>(
    buildBatchUiPrompt(target),
    JSON.stringify(subset),
    { temperature: 0.1 }
  );

  const merged: Record<string, string> = { ...enMessages };
  for (const key of Object.keys(subset)) {
    const translated = result[key];
    if (typeof translated === "string" && translated.trim()) {
      merged[key] = translated.trim();
    }
  }
  return merged;
}

/** Translate an array of strings (batch, sequential for small models). */
export async function translateTexts(
  texts: string[],
  targetLanguage: string,
  sourceLanguage?: string
): Promise<TextTranslationResult[]> {
  const results: TextTranslationResult[] = [];
  for (const text of texts) {
    results.push(await translateText(text, targetLanguage, sourceLanguage));
  }
  return results;
}