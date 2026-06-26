import { chatJson } from "@/lib/llm";
import { isSupportedLanguage, DEFAULT_LOCALE } from "@/lib/i18n/languages";
import {
  enMessages,
  getStaticMessages,
  type MessageKey,
} from "@/lib/i18n/messages";

export interface TextTranslationResult {
  translatedText: string;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: number;
}

function buildTextPrompt(
  targetLanguage: string,
  sourceLanguage?: string,
  uiLabel = false
): string {
  const target = targetLanguage.toUpperCase();
  const sourceHint = sourceLanguage
    ? `from ${sourceLanguage.toUpperCase()} `
    : "";
  const labelHint = uiLabel
    ? " This is a short UI label in a SaaS dashboard — use the standard translation for that control."
    : "";
  return `You are a professional translator. Translate the user text ${sourceHint}to ${target} (${targetLanguage}).${labelHint}
Return STRICT JSON only: {"translatedText": string, "detectedLanguage": string (ISO 639-1 source code), "confidence": number (0-1)}.
Preserve meaning, tone, and technical terms. Do not add commentary.`;
}

const UI_BATCH_SIZE = 4;

function buildBatchUiPrompt(targetLanguage: string): string {
  return `You are a professional UI translator. Translate every string VALUE in the input JSON to ${targetLanguage} (${targetLanguage.toUpperCase()}).
CRITICAL: Keep every JSON key EXACTLY as given (e.g. "nav.dashboard" must stay "nav.dashboard" — never shorten or rename keys).
Return STRICT JSON only: same keys as input, translated string values only.
Use concise, natural UI phrasing suitable for a SaaS dashboard.`;
}

function chunkRecord<T extends Record<string, string>>(
  record: T,
  size: number
): Array<Record<string, string>> {
  const entries = Object.entries(record);
  const chunks: Array<Record<string, string>> = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return chunks;
}

function mergeUiBatchResult(
  subset: Record<string, string>,
  result: Record<string, unknown>
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const key of Object.keys(subset)) {
    const translated = result[key];
    if (
      typeof translated === "string" &&
      translated.trim() &&
      translated.trim() !== subset[key]
    ) {
      merged[key] = translated.trim();
    }
  }
  return merged;
}

async function translateUiBatch(
  subset: Record<string, string>,
  targetLanguage: string,
  maxAttempts = 3
): Promise<Record<string, string>> {
  const pending = { ...subset };
  const merged: Record<string, string> = {};

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (Object.keys(pending).length === 0) break;

    const result = await chatJson<Record<string, unknown>>(
      buildBatchUiPrompt(targetLanguage),
      JSON.stringify(pending),
      { temperature: 0.1 }
    );

    const batch = mergeUiBatchResult(pending, result);
    Object.assign(merged, batch);
    for (const key of Object.keys(batch)) {
      delete pending[key];
    }
  }

  for (const [key, source] of Object.entries(pending)) {
    const single = await translateText(source, targetLanguage, DEFAULT_LOCALE);
    if (single.translatedText.trim() && single.translatedText.trim() !== source) {
      merged[key] = single.translatedText.trim();
    }
  }

  return merged;
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

  const isUiLabel = text.length < 50;
  let result = await chatJson<{
    translatedText?: string;
    detectedLanguage?: string;
    confidence?: number;
  }>(buildTextPrompt(target, sourceLanguage, isUiLabel), wrapUntrustedText(text), {
    temperature: 0.1,
  });

  let translatedText =
    typeof result.translatedText === "string" ? result.translatedText : text;

  if (
    isUiLabel &&
    sourceLanguage &&
    sourceLanguage !== target &&
    translatedText.trim() === text.trim()
  ) {
    result = await chatJson<{
      translatedText?: string;
      detectedLanguage?: string;
      confidence?: number;
    }>(
      buildTextPrompt(target, sourceLanguage, true),
      wrapUntrustedText(text),
      { temperature: 0.1, maxAttempts: 3 }
    );
    if (typeof result.translatedText === "string") {
      translatedText = result.translatedText;
    }
  }

  return {
    translatedText,
    detectedLanguage: sourceLanguage
      ? sourceLanguage
      : typeof result.detectedLanguage === "string"
        ? result.detectedLanguage
        : DEFAULT_LOCALE,
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

  const staticMessages = getStaticMessages(target);
  if (staticMessages && !keys?.length) {
    return staticMessages;
  }

  const subset = keys?.length
    ? Object.fromEntries(keys.map((k) => [k, enMessages[k]]))
    : { ...enMessages };

  const merged: Record<string, string> = { ...enMessages };
  const chunks = chunkRecord(subset, UI_BATCH_SIZE);

  for (const chunk of chunks) {
    const translated = await translateUiBatch(chunk, target);
    Object.assign(merged, translated);
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