import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with mock feedbackItem + feedbackAnalysis models we control.
const { mockFeedbackItem, mockFeedbackAnalysis } = vi.hoisted(() => ({
  mockFeedbackItem: {
    findUnique: vi.fn(),
  },
  mockFeedbackAnalysis: {
    update: vi.fn(),
  },
}));

// Mock the LLM chatJson so no network/provider call is made.
const { mockChatJson } = vi.hoisted(() => ({
  mockChatJson: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: mockFeedbackItem,
    feedbackAnalysis: mockFeedbackAnalysis,
  },
}));

vi.mock("@/lib/llm", () => ({
  chatJson: mockChatJson,
}));

import {
  translateFeedback,
  batchTranslate,
  getTranslationStatus,
  TRANSLATION_SYSTEM_PROMPT,
  FeedbackItemNotFoundError,
} from "@/lib/translation";

beforeEach(() => {
  mockFeedbackItem.findUnique.mockReset();
  mockFeedbackAnalysis.update.mockReset();
  mockChatJson.mockReset();
});

describe("translation", () => {
  describe("translateFeedback", () => {
    it("skips the LLM for English items and returns the existing translatedSummary", async () => {
      const item = {
        id: "fi-1",
        title: "Login broken",
        rawContent: "I can't log in.",
        source: "GitHubIssues",
        analysis: {
          language: "en",
          translatedSummary: "Existing English summary",
        },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);

      const result = await translateFeedback("fi-1");

      expect(mockFeedbackItem.findUnique).toHaveBeenCalledWith({
        where: { id: "fi-1" },
        include: { analysis: true },
      });
      expect(mockChatJson).not.toHaveBeenCalled();
      expect(mockFeedbackAnalysis.update).not.toHaveBeenCalled();
      expect(result).toEqual({
        translatedText: "Existing English summary",
        detectedLanguage: "en",
        confidence: 1,
      });
    });

    it("returns null translatedText for English items with no stored translation", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-1",
        rawContent: "Hello",
        analysis: { language: "en", translatedSummary: null },
      });

      const result = await translateFeedback("fi-1");
      expect(mockChatJson).not.toHaveBeenCalled();
      expect(result.translatedText).toBeNull();
      expect(result.detectedLanguage).toBe("en");
    });

    it("calls the LLM for non-English items and persists the translation", async () => {
      const item = {
        id: "fi-2",
        title: "Problema de inicio de sesión",
        rawContent: "No puedo iniciar sesión, sigue redirigiendo.",
        source: "Reddit",
        analysis: { language: "es", translatedSummary: null },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockFeedbackAnalysis.update.mockResolvedValue({});
      mockChatJson.mockResolvedValue({
        translatedText: "I can't log in, it keeps redirecting.",
        detectedLanguage: "es",
        confidence: 0.97,
      });

      const result = await translateFeedback("fi-2");

      expect(mockChatJson).toHaveBeenCalledTimes(1);
      const [systemPrompt, userPrompt] = mockChatJson.mock.calls[0];
      expect(systemPrompt).toBe(TRANSLATION_SYSTEM_PROMPT);
      expect(userPrompt).toContain("No puedo iniciar sesión");
      expect(mockFeedbackAnalysis.update).toHaveBeenCalledWith({
        where: { feedbackItemId: "fi-2" },
        data: {
          translatedSummary: "I can't log in, it keeps redirecting.",
          language: "es",
        },
      });
      expect(result).toEqual({
        translatedText: "I can't log in, it keeps redirecting.",
        detectedLanguage: "es",
        confidence: 0.97,
      });
    });

    it("throws FeedbackItemNotFoundError when the item does not exist", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);

      await expect(translateFeedback("missing")).rejects.toBeInstanceOf(
        FeedbackItemNotFoundError
      );
      expect(mockChatJson).not.toHaveBeenCalled();
    });
  });

  describe("batchTranslate", () => {
    it("translates all items successfully", async () => {
      mockFeedbackItem.findUnique
        .mockResolvedValueOnce({
          id: "fi-1",
          rawContent: "Hello",
          analysis: { language: "en", translatedSummary: "Hello" },
        })
        .mockResolvedValueOnce({
          id: "fi-2",
          rawContent: "Bonjour",
          analysis: { language: "fr", translatedSummary: null },
        });
      mockFeedbackAnalysis.update.mockResolvedValue({});
      mockChatJson.mockResolvedValue({
        translatedText: "Hello",
        detectedLanguage: "fr",
        confidence: 0.9,
      });

      const results = await batchTranslate(["fi-1", "fi-2"]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("fi-1");
      expect(results[0].result?.translatedText).toBe("Hello");
      expect(results[1].id).toBe("fi-2");
      expect(results[1].result?.translatedText).toBe("Hello");
      expect(results[0].error).toBeUndefined();
      expect(results[1].error).toBeUndefined();
    });

    it("isolates failures so one missing item does not abort the batch", async () => {
      mockFeedbackItem.findUnique
        .mockResolvedValueOnce(null) // fi-1 missing -> error
        .mockResolvedValueOnce({
          id: "fi-2",
          rawContent: "Hola",
          analysis: { language: "es", translatedSummary: null },
        });
      mockFeedbackAnalysis.update.mockResolvedValue({});
      mockChatJson.mockResolvedValue({
        translatedText: "Hello",
        detectedLanguage: "es",
        confidence: 0.95,
      });

      const results = await batchTranslate(["fi-1", "fi-2"]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("fi-1");
      expect(results[0].error).toBeTruthy();
      expect(results[0].result).toBeUndefined();
      expect(results[1].id).toBe("fi-2");
      expect(results[1].result?.translatedText).toBe("Hello");
      expect(results[1].error).toBeUndefined();
    });
  });

  describe("getTranslationStatus", () => {
    it("reports language and translation presence from the analysis", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-1",
        rawContent: "Hola",
        analysis: { language: "es", translatedSummary: "Hello" },
      });

      const status = await getTranslationStatus("fi-1");
      expect(status).toEqual({
        language: "es",
        hasTranslation: true,
        translatedSummary: "Hello",
      });
    });

    it("returns hasTranslation false when no translatedSummary is stored", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-2",
        rawContent: "Hola",
        analysis: { language: "es", translatedSummary: null },
      });

      const status = await getTranslationStatus("fi-2");
      expect(status).toEqual({
        language: "es",
        hasTranslation: false,
        translatedSummary: null,
      });
    });

    it("returns null language and false hasTranslation when the item is missing", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);

      const status = await getTranslationStatus("missing");
      expect(status).toEqual({
        language: null,
        hasTranslation: false,
        translatedSummary: null,
      });
    });
  });
});
