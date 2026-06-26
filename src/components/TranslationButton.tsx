"use client";

import { useEffect, useState } from "react";
import {
  SUPPORTED_LANGUAGES,
  getLanguageLabel,
} from "@/lib/i18n/languages";
import { useTranslation } from "@/contexts/LocaleContext";

interface TranslationResponse {
  translatedText: string | null;
  detectedLanguage: string;
  targetLanguage: string;
  confidence: number;
}

export function TranslationButton({
  feedbackItemId,
  language,
  hasTranslation,
  initialTranslation,
}: {
  feedbackItemId: string;
  language: string | null;
  hasTranslation: boolean;
  initialTranslation?: string | null;
}) {
  const { locale, t } = useTranslation();
  const [targetLanguage, setTargetLanguage] = useState(locale);
  const [translatedText, setTranslatedText] = useState<string | null>(
    initialTranslation ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(
    language ?? null
  );

  useEffect(() => {
    setTargetLanguage(locale);
  }, [locale]);

  const sourceLang = detectedLanguage ?? language;
  const needsTranslation =
    sourceLang && targetLanguage && sourceLang !== targetLanguage;

  async function handleTranslate() {
    if (loading || !needsTranslation) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage }),
      });
      if (!res.ok) {
        const data = await res
          .json()
          .catch(() => ({ error: "Failed to translate feedback" }));
        throw new Error(data.error ?? "Failed to translate feedback");
      }
      const data = (await res.json()) as TranslationResponse;
      setTranslatedText(data.translatedText);
      setDetectedLanguage(data.detectedLanguage);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to translate feedback"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!language) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-slate-600">
          {t("translation.to")}
        </label>
        <select
          value={targetLanguage}
          onChange={(e) => {
            setTargetLanguage(e.target.value);
            setTranslatedText(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeLabel}
            </option>
          ))}
        </select>
        {needsTranslation && !translatedText && (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? t("translation.translating") : t("translation.translate")}
          </button>
        )}
      </div>

      {sourceLang && (
        <p className="text-xs text-slate-500">
          {t("translation.detected")}: {getLanguageLabel(sourceLang)} ({sourceLang})
        </p>
      )}

      {error && (
        <p className="text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {loading && !translatedText && (
        <p className="text-sm text-slate-500">{t("translation.translating")}</p>
      )}

      {translatedText && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
          {translatedText}
        </p>
      )}

      {!needsTranslation && !translatedText && (
        <p className="text-xs text-slate-400">
          Content is already in {getLanguageLabel(targetLanguage)}.
        </p>
      )}
    </div>
  );
}