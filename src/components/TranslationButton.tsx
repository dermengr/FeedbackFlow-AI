"use client";

import { useState } from "react";

interface TranslationResponse {
  translatedText: string | null;
  detectedLanguage: string;
  confidence: number;
}

/**
 * Feedback Translation button.
 *
 * For non-English feedback items, renders a "Translate to English" button that
 * calls the local LLM (via /api/feedback/:id/translate) to produce an English
 * translation. If a translation is already available it is shown directly.
 * Shows a loading state while the request is in flight.
 */
export function TranslationButton({
  feedbackItemId,
  language,
  hasTranslation,
}: {
  feedbackItemId: string;
  language: string | null;
  hasTranslation: boolean;
}) {
  const [translatedText, setTranslatedText] = useState<string | null>(
    hasTranslation ? null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedLanguage, setDetectedLanguage] = useState<string | null>(
    language ?? null
  );

  // Nothing to do for English feedback.
  const isEnglish = language === "en";

  async function handleTranslate() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/feedback/${feedbackItemId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // English feedback needs no translation UI.
  if (isEnglish) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-slate-900">
          Translation
        </h2>
        {!translatedText && (
          <button
            type="button"
            onClick={handleTranslate}
            disabled={loading}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Translating…" : "Translate to English"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}

      {loading && !translatedText && (
        <p className="mt-3 text-sm text-slate-500">Translating feedback…</p>
      )}

      {translatedText && (
        <div className="mt-3 space-y-1">
          {detectedLanguage && detectedLanguage !== "en" && (
            <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium uppercase text-sky-700 ring-1 ring-inset ring-sky-600/20">
              {detectedLanguage}
            </span>
          )}
          <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
            {translatedText}
          </p>
        </div>
      )}
    </section>
  );
}
