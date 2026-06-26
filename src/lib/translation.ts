import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

// System prompt instructing the local LLM to act as a professional translator.
// Kept as a module-level constant so tests can assert against it.
export const TRANSLATION_SYSTEM_PROMPT =
  "You are a professional translator. Translate the text to English. Return JSON with {translatedText, detectedLanguage, confidence}";

export class FeedbackItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Feedback item not found: ${id}`);
    this.name = "FeedbackItemNotFoundError";
  }
}

/** Shape returned by the LLM translation call and by `translateFeedback`. */
export interface TranslationResult {
  translatedText: string | null;
  detectedLanguage: string;
  confidence: number;
}

/** Shape returned by `getTranslationStatus`. */
export interface TranslationStatus {
  language: string | null;
  hasTranslation: boolean;
  translatedSummary: string | null;
}

interface LlmTranslationResponse {
  translatedText: string;
  detectedLanguage: string;
  confidence: number;
}

/**
 * Translate a single feedback item's content to English using the local LLM.
 *
 * Fetches the FeedbackItem together with its FeedbackAnalysis from Prisma.
 * If the analysis already reports the language as English ("en"), no LLM call
 * is made and the existing `translatedSummary` (or null) is returned. Otherwise
 * the raw feedback content is sent to `chatJson` for translation and the
 * resulting English text is persisted back onto the analysis record.
 *
 * @returns The translation result ({translatedText, detectedLanguage, confidence}).
 * @throws {FeedbackItemNotFoundError} if no FeedbackItem exists for the id.
 */
export async function translateFeedback(
  feedbackItemId: string
): Promise<TranslationResult> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  if (!item) {
    throw new FeedbackItemNotFoundError(feedbackItemId);
  }

  const language = item.analysis?.language ?? null;

  // Already English: skip the LLM and return any existing translation.
  if (language === "en") {
    return {
      translatedText: item.analysis?.translatedSummary ?? null,
      detectedLanguage: "en",
      confidence: 1,
    };
  }

  // Reuse a persisted translation when available.
  if (item.analysis?.translatedSummary) {
    return {
      translatedText: item.analysis.translatedSummary,
      detectedLanguage: language ?? "en",
      confidence: 1,
    };
  }

  // Truncate raw content to limit prompt size / cost.
  const userPrompt = item.rawContent.slice(0, 4000);

  const result = await chatJson<LlmTranslationResponse>(
    TRANSLATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.2 }
  );

  const translatedText =
    typeof result.translatedText === "string" ? result.translatedText : "";
  const detectedLanguage =
    typeof result.detectedLanguage === "string" ? result.detectedLanguage : "en";
  const confidence =
    typeof result.confidence === "number" && !Number.isNaN(result.confidence)
      ? result.confidence
      : 0;

  // Persist the translation so subsequent status checks reflect it.
  if (item.analysis) {
    await prisma.feedbackAnalysis.update({
      where: { feedbackItemId },
      data: {
        translatedSummary: translatedText,
        language: detectedLanguage,
      },
    });
  }

  return { translatedText, detectedLanguage, confidence };
}

/**
 * Translate multiple feedback items, isolating failures so one bad item does
 * not abort the whole batch.
 *
 * @returns An array of results aligned to the input ids. Items that failed are
 * represented by an entry with an `error` message instead of a translation.
 */
export async function batchTranslate(
  feedbackItemIds: string[]
): Promise<Array<{ id: string; result?: TranslationResult; error?: string }>> {
  const results: Array<{ id: string; result?: TranslationResult; error?: string }> = [];

  for (const id of feedbackItemIds) {
    try {
      const result = await translateFeedback(id);
      results.push({ id, result });
    } catch (err) {
      results.push({
        id,
        error: err instanceof Error ? err.message : "Translation failed",
      });
    }
  }

  return results;
}

/**
 * Report the current translation status for a feedback item without invoking
 * the LLM.
 *
 * @returns {language, hasTranslation, translatedSummary}. If the item or its
 * analysis cannot be found, language and translatedSummary are null and
 * hasTranslation is false.
 */
export async function getTranslationStatus(
  feedbackItemId: string
): Promise<TranslationStatus> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  const language = item?.analysis?.language ?? null;
  const translatedSummary = item?.analysis?.translatedSummary ?? null;

  return {
    language,
    hasTranslation: Boolean(translatedSummary),
    translatedSummary,
  };
}
