import { describe, it, expect, vi, beforeEach } from "vitest";

// Tests for the extended Zod analysis schema (B6/B7/B8): language detection,
// action-item extraction, and emotion classification.

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

vi.mock("@/lib/utils", () => ({
  backoffDelay: (attempt: number) => Math.min(1000 * Math.pow(2, attempt - 1), 10000),
  sleep: (_ms: number) => new Promise((resolve) => setTimeout(resolve, 0)),
}));

beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";
  mockCreate.mockReset();
});

import { analyzeFeedback } from "@/lib/llm";
import type { RawFeedbackItem } from "@/lib/types";

const sampleItem: RawFeedbackItem = {
  source: "GitHubIssues",
  externalId: "vercel/next.js#12345",
  title: "App crashes on startup",
  rawContent: "The app crashes every time I try to open it on iOS 17.",
  authorLogin: "user123",
  url: "https://github.com/vercel/next.js/issues/12345",
  originalTimestamp: new Date("2026-01-15T10:00:00Z"),
};

function mockResponse(content: string) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content } }],
  });
}

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    sentiment: "negative",
    topics: ["Bug Report"],
    severity_score: 4,
    summary: "App crashes on startup on iOS 17.",
    language: "en",
    translated_summary: null,
    emotion: "frustrated",
    action_items: ["Fix iOS 17 crash on startup"],
    ...overrides,
  };
}

describe("LLM upgrades (B6/B7/B8)", () => {
  describe("analyzeFeedback extended schema", () => {
    it("accepts and returns the extended fields", async () => {
      mockResponse(JSON.stringify(basePayload()));

      const result = await analyzeFeedback(sampleItem, { maxAttempts: 1 });
      expect(result.language).toBe("en");
      expect(result.translatedSummary).toBeNull();
      expect(result.emotion).toBe("frustrated");
      expect(result.actionItems).toEqual(["Fix iOS 17 crash on startup"]);
    });

    it("accepts a non-English language with a translated summary", async () => {
      mockResponse(
        JSON.stringify(
          basePayload({
            language: "es",
            translated_summary: "The app crashes on startup on iOS 17.",
            summary: "La app se cuelga al abrir en iOS 17.",
            emotion: "angry",
          })
        )
      );

      const result = await analyzeFeedback(sampleItem, { maxAttempts: 1 });
      expect(result.language).toBe("es");
      expect(result.translatedSummary).toBe(
        "The app crashes on startup on iOS 17."
      );
      expect(result.emotion).toBe("angry");
    });

    it("allows translated_summary to be null", async () => {
      mockResponse(
        JSON.stringify(
          basePayload({ language: "en", translated_summary: null })
        )
      );

      const result = await analyzeFeedback(sampleItem, { maxAttempts: 1 });
      expect(result.translatedSummary).toBeNull();
    });

    it("allows an empty action_items array", async () => {
      mockResponse(JSON.stringify(basePayload({ action_items: [] })));

      const result = await analyzeFeedback(sampleItem, { maxAttempts: 1 });
      expect(result.actionItems).toEqual([]);
    });

    it("defaults action_items to [] when omitted", async () => {
      const { action_items, ...withoutActionItems } = basePayload();
      mockResponse(JSON.stringify(withoutActionItems));

      const result = await analyzeFeedback(sampleItem, { maxAttempts: 1 });
      expect(result.actionItems).toEqual([]);
    });

    it("rejects an invalid emotion value", async () => {
      mockResponse(
        JSON.stringify(basePayload({ emotion: "furious" }))
      );

      await expect(
        analyzeFeedback(sampleItem, { maxAttempts: 1 })
      ).rejects.toThrow();
    });

    it("rejects a language code shorter than 2 chars", async () => {
      mockResponse(JSON.stringify(basePayload({ language: "e" })));

      await expect(
        analyzeFeedback(sampleItem, { maxAttempts: 1 })
      ).rejects.toThrow();
    });

    it("rejects a language code longer than 5 chars", async () => {
      mockResponse(
        JSON.stringify(basePayload({ language: "en-US-extra" }))
      );

      await expect(
        analyzeFeedback(sampleItem, { maxAttempts: 1 })
      ).rejects.toThrow();
    });

    it("rejects more than 5 action items", async () => {
      mockResponse(
        JSON.stringify(
          basePayload({
            action_items: [
              "Do A",
              "Do B",
              "Do C",
              "Do D",
              "Do E",
              "Do F",
            ],
          })
        )
      );

      await expect(
        analyzeFeedback(sampleItem, { maxAttempts: 1 })
      ).rejects.toThrow();
    });

    it("rejects a non-null non-string translated_summary", async () => {
      mockResponse(
        JSON.stringify(basePayload({ translated_summary: 123 }))
      );

      await expect(
        analyzeFeedback(sampleItem, { maxAttempts: 1 })
      ).rejects.toThrow();
    });
  });
});
