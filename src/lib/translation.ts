import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { translateText } from "@/lib/app-translation";
import { DEFAULT_LOCALE, isSupportedLanguage } from "@/lib/i18n/languages";

export class FeedbackItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Feedback item not found: ${id}`);
    this.name = "FeedbackItemNotFoundError";
  }
}

export interface TranslationResult {
  translatedText: string | null;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export interface TranslationStatus {
  language: string | null;
  hasTranslation: boolean;
  translatedSummary: string | null;
  translations: Record<string, string>;
}

function parseTranslations(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
  }
  return out;
}

function getCachedTranslation(
  translations: Record<string, string>,
  targetLanguage: string,
  translatedSummary: string | null
): string | null {
  if (translations[targetLanguage]) return translations[targetLanguage];
  if (targetLanguage === DEFAULT_LOCALE && translatedSummary) {
    return translatedSummary;
  }
  return null;
}

/**
 * Translate feedback content to a target language using the configured LLM.
 * Caches per-language results in `analysis.translations` JSON.
 */
export async function translateFeedback(
  feedbackItemId: string,
  targetLanguage: string = DEFAULT_LOCALE
): Promise<TranslationResult> {
  const target = targetLanguage.trim().toLowerCase();
  if (!isSupportedLanguage(target)) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  if (!item) {
    throw new FeedbackItemNotFoundError(feedbackItemId);
  }

  const sourceLanguage = item.analysis?.language ?? null;
  const existingTranslations = parseTranslations(item.analysis?.translations);
  const cached = getCachedTranslation(
    existingTranslations,
    target,
    item.analysis?.translatedSummary ?? null
  );

  if (cached) {
    return {
      translatedText: cached,
      detectedLanguage: sourceLanguage ?? DEFAULT_LOCALE,
      targetLanguage: target,
      confidence: 1,
    };
  }

  const sourceText = item.rawContent.slice(0, 4000);
  const result = await translateText(
    sourceText,
    target,
    sourceLanguage ?? undefined
  );

  if (item.analysis) {
    const nextTranslations = {
      ...existingTranslations,
      [target]: result.translatedText,
    };
    const updateData: Prisma.FeedbackAnalysisUpdateInput = {
      translations: nextTranslations as Prisma.InputJsonValue,
      language: result.detectedLanguage,
    };
    if (target === DEFAULT_LOCALE) {
      updateData.translatedSummary = result.translatedText;
    }
    await prisma.feedbackAnalysis.update({
      where: { feedbackItemId },
      data: updateData,
    });
  }

  return {
    translatedText: result.translatedText,
    detectedLanguage: result.detectedLanguage,
    targetLanguage: target,
    confidence: result.confidence,
  };
}

export async function batchTranslate(
  feedbackItemIds: string[],
  targetLanguage: string = DEFAULT_LOCALE
): Promise<Array<{ id: string; result?: TranslationResult; error?: string }>> {
  const results: Array<{ id: string; result?: TranslationResult; error?: string }> = [];

  for (const id of feedbackItemIds) {
    try {
      const result = await translateFeedback(id, targetLanguage);
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

export async function getTranslationStatus(
  feedbackItemId: string,
  targetLanguage?: string
): Promise<TranslationStatus> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  const language = item?.analysis?.language ?? null;
  const translatedSummary = item?.analysis?.translatedSummary ?? null;
  const translations = parseTranslations(item?.analysis?.translations);

  const target = targetLanguage?.trim().toLowerCase();
  const hasTranslation = target
    ? Boolean(getCachedTranslation(translations, target, translatedSummary))
    : Boolean(translatedSummary) || Object.keys(translations).length > 0;

  return {
    language,
    hasTranslation,
    translatedSummary,
    translations,
  };
}