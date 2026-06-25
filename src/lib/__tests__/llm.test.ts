import { describe, it, expect, vi, beforeEach } from "vitest";

// Test the Zod schema validation and prompt building logic from the LLM module.

// We need to mock the OpenAI module so that `new OpenAI()` returns an object
// with a `chat.completions.create` method we control.

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

// Set env vars for tests
beforeEach(() => {
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-4o-mini";
  mockCreate.mockReset();
});

import { analyzeFeedback, analyzeBatch } from "@/lib/llm";
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

describe("LLM module", () => {
  describe("analyzeFeedback", () => {
    it("returns validated analysis on successful LLM response", async () => {
      mockResponse(JSON.stringify({
        sentiment: "negative",
        topics: ["Bug Report", "Performance"],
        severity_score: 4,
        summary: "App crashes on startup on iOS 17.",
      }));

      const result = await analyzeFeedback(sampleItem);
      expect(result.sentiment).toBe("negative");
      expect(result.topics).toEqual(["Bug Report", "Performance"]);
      expect(result.severity_score).toBe(4);
      expect(result.summary).toBe("App crashes on startup on iOS 17.");
    });

    it("rejects invalid sentiment values via Zod", async () => {
      mockResponse(JSON.stringify({
        sentiment: "very_positive",
        topics: ["Bug Report"],
        severity_score: 3,
        summary: "Some summary.",
      }));

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });

    it("rejects severity scores outside 1-5 range", async () => {
      mockResponse(JSON.stringify({
        sentiment: "negative",
        topics: ["Bug Report"],
        severity_score: 10,
        summary: "Some summary.",
      }));

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });

    it("rejects empty topic arrays", async () => {
      mockResponse(JSON.stringify({
        sentiment: "neutral",
        topics: [],
        severity_score: 2,
        summary: "Some summary.",
      }));

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });

    it("rejects summaries longer than 300 chars", async () => {
      mockResponse(JSON.stringify({
        sentiment: "neutral",
        topics: ["Bug Report"],
        severity_score: 2,
        summary: "A".repeat(301),
      }));

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });

    it("handles invalid JSON responses", async () => {
      mockResponse("not valid json at all");

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });

    it("handles empty LLM responses", async () => {
      mockResponse("");

      await expect(analyzeFeedback(sampleItem, { maxAttempts: 1 })).rejects.toThrow();
    });
  });

  describe("analyzeBatch", () => {
    it("isolates failures so one bad item doesn't abort the batch", async () => {
      const items = [
        sampleItem,
        { ...sampleItem, externalId: "vercel/next.js#99999" },
      ];

      // First call succeeds, second call returns invalid JSON
      mockCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify({
            sentiment: "negative",
            topics: ["Bug Report"],
            severity_score: 4,
            summary: "Crash.",
          }) } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: "not json at all" } }],
        });

      const result = await analyzeBatch(items, { maxAttempts: 1 });

      expect(result.results).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].item.externalId).toBe("vercel/next.js#99999");
    });

    it("returns all results when all items succeed", async () => {
      const items = [
        sampleItem,
        { ...sampleItem, externalId: "vercel/next.js#99998" },
      ];

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({
          sentiment: "neutral",
          topics: ["Other"],
          severity_score: 2,
          summary: "OK.",
        }) } }],
      });

      const result = await analyzeBatch(items, { maxAttempts: 1 });

      expect(result.results).toHaveLength(2);
      expect(result.failures).toHaveLength(0);
    });
  });
});
