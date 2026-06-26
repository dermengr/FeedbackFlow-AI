import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFeedbackItem, mockFeedbackAnalysis } = vi.hoisted(() => ({
  mockFeedbackItem: { findUnique: vi.fn() },
  mockFeedbackAnalysis: { update: vi.fn() },
}));

const { mockTranslateText } = vi.hoisted(() => ({
  mockTranslateText: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: mockFeedbackItem,
    feedbackAnalysis: mockFeedbackAnalysis,
  },
}));

vi.mock("@/lib/app-translation", () => ({
  translateText: mockTranslateText,
}));

import {
  translateFeedback,
  batchTranslate,
  getTranslationStatus,
  FeedbackItemNotFoundError,
} from "@/lib/translation";

beforeEach(() => {
  mockFeedbackItem.findUnique.mockReset();
  mockFeedbackAnalysis.update.mockReset();
  mockTranslateText.mockReset();
});

describe("translation", () => {
  describe("translateFeedback", () => {
    it("returns cached English translation without calling the LLM", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-1",
        rawContent: "Hola",
        analysis: {
          language: "es",
          translatedSummary: "Hello",
          translations: { en: "Hello" },
        },
      });

      const result = await translateFeedback("fi-1", "en");

      expect(mockTranslateText).not.toHaveBeenCalled();
      expect(result).toEqual({
        translatedText: "Hello",
        detectedLanguage: "es",
        targetLanguage: "en",
        confidence: 1,
      });
    });

    it("translates to Spanish and persists in translations JSON", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-2",
        rawContent: "Login is broken",
        analysis: {
          language: "en",
          translatedSummary: null,
          translations: {},
        },
      });
      mockFeedbackAnalysis.update.mockResolvedValue({});
      mockTranslateText.mockResolvedValue({
        translatedText: "El inicio de sesión está roto",
        detectedLanguage: "en",
        targetLanguage: "es",
        confidence: 0.95,
      });

      const result = await translateFeedback("fi-2", "es");

      expect(mockTranslateText).toHaveBeenCalledWith(
        "Login is broken",
        "es",
        "en"
      );
      expect(mockFeedbackAnalysis.update).toHaveBeenCalledWith({
        where: { feedbackItemId: "fi-2" },
        data: {
          translations: { es: "El inicio de sesión está roto" },
          language: "en",
        },
      });
      expect(result.targetLanguage).toBe("es");
    });

    it("throws FeedbackItemNotFoundError when missing", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);
      await expect(translateFeedback("missing")).rejects.toBeInstanceOf(
        FeedbackItemNotFoundError
      );
    });
  });

  describe("getTranslationStatus", () => {
    it("returns translations map from analysis", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-1",
        analysis: {
          language: "es",
          translatedSummary: "Hello",
          translations: { en: "Hello", fr: "Bonjour" },
        },
      });

      const status = await getTranslationStatus("fi-1", "fr");
      expect(status.hasTranslation).toBe(true);
      expect(status.translations.fr).toBe("Bonjour");
    });
  });

  describe("batchTranslate", () => {
    it("isolates failures per item", async () => {
      mockFeedbackItem.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "fi-2",
          rawContent: "Hola",
          analysis: { language: "es", translations: { en: "Hello" } },
        });

      const results = await batchTranslate(["fi-1", "fi-2"], "en");
      expect(results[0].error).toBeTruthy();
      expect(results[1].result?.translatedText).toBe("Hello");
    });
  });
});