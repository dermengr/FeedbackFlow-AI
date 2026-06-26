import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock feedbackItem model we control from each test.
const { mockFeedbackItem } = vi.hoisted(() => ({
  mockFeedbackItem: {
    findUnique: vi.fn(),
  },
}));

// Mock the LLM chatJson so no network/provider call is made.
const { mockChatJson } = vi.hoisted(() => ({
  mockChatJson: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: mockFeedbackItem,
  },
}));

vi.mock("@/lib/llm", () => ({
  chatJson: mockChatJson,
}));

import {
  suggestCategories,
  batchSuggestCategories,
  buildCategorizationPrompt,
  SMART_CATEGORIZATION_SYSTEM_PROMPT,
  FeedbackItemNotFoundError,
} from "@/lib/smart-categorization";

beforeEach(() => {
  mockFeedbackItem.findUnique.mockReset();
  mockChatJson.mockReset();
});

describe("smart-categorization", () => {
  describe("suggestCategories", () => {
    it("fetches the item with its analysis and returns normalized suggestions", async () => {
      const item = {
        id: "fi-1",
        title: "Login broken",
        rawContent: "I can't log in, it keeps redirecting in a loop.",
        authorLogin: "alice",
        source: "GitHubIssues",
        analysis: {
          sentiment: "negative",
          severityScore: 4,
          summary: "User reports a login redirect loop.",
          emotion: "frustrated",
          topics: ["Bug Report", "Authentication"],
          actionItems: ["Fix login redirect loop"],
        },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockChatJson.mockResolvedValue({
        categories: ["Login Redirect Loop", "Authentication Friction"],
        reasoning: "The feedback describes a cyclic redirect during login.",
      });

      const result = await suggestCategories("fi-1");

      expect(mockFeedbackItem.findUnique).toHaveBeenCalledWith({
        where: { id: "fi-1" },
        include: { analysis: true },
      });
      expect(mockChatJson).toHaveBeenCalledTimes(1);
      expect(mockChatJson).toHaveBeenCalledWith(
        SMART_CATEGORIZATION_SYSTEM_PROMPT,
        expect.any(String),
        expect.objectContaining({ temperature: 0.3 })
      );
      expect(result).toEqual({
        feedbackItemId: "fi-1",
        categories: ["Login Redirect Loop", "Authentication Friction"],
        reasoning: "The feedback describes a cyclic redirect during login.",
      });
    });

    it("builds a user prompt that includes analysis context and raw content", async () => {
      const item = {
        id: "fi-1",
        title: "Bug",
        rawContent: "App crashes on startup.",
        authorLogin: "bob",
        source: "Reddit",
        analysis: {
          sentiment: "negative",
          severityScore: 5,
          summary: "Crash on startup.",
          emotion: "angry",
          topics: ["Bug Report"],
          actionItems: ["Fix crash"],
        },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockChatJson.mockResolvedValue({ categories: ["Startup Crash"], reasoning: "r" });

      await suggestCategories("fi-1");

      const userPrompt = mockChatJson.mock.calls[0][1] as string;
      expect(userPrompt).toContain("Source: Reddit");
      expect(userPrompt).toContain("Author: bob");
      expect(userPrompt).toContain("Title: Bug");
      expect(userPrompt).toContain("Sentiment: negative");
      expect(userPrompt).toContain("Severity (1-5): 5");
      expect(userPrompt).toContain("Summary: Crash on startup.");
      expect(userPrompt).toContain("Detected emotion: angry");
      expect(userPrompt).toContain("App crashes on startup.");
    });

    it("works when the item has no analysis", async () => {
      const item = {
        id: "fi-2",
        title: null,
        rawContent: "Great product!",
        authorLogin: null,
        source: "Trustpilot",
        analysis: null,
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockChatJson.mockResolvedValue({ categories: ["Praise"], reasoning: "Positive." });

      const result = await suggestCategories("fi-2");

      expect(result.feedbackItemId).toBe("fi-2");
      const userPrompt = mockChatJson.mock.calls[0][1] as string;
      expect(userPrompt).toContain("No structured analysis available.");
      expect(userPrompt).not.toContain("Sentiment:");
    });

    it("throws FeedbackItemNotFoundError when the item does not exist", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);

      await expect(suggestCategories("missing")).rejects.toBeInstanceOf(
        FeedbackItemNotFoundError
      );
      expect(mockChatJson).not.toHaveBeenCalled();
    });

    it("propagates LLM errors", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-3",
        title: "x",
        rawContent: "x",
        authorLogin: null,
        source: "RSS",
        analysis: null,
      });
      mockChatJson.mockRejectedValue(new Error("LLM down"));

      await expect(suggestCategories("fi-3")).rejects.toThrow("LLM down");
    });

    it("normalizes a malformed LLM response into a safe shape", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-4",
        title: "x",
        rawContent: "x",
        authorLogin: null,
        source: "RSS",
        analysis: null,
      });
      // Missing reasoning, categories contains non-string junk + empties.
      mockChatJson.mockResolvedValue({
        categories: ["Valid", 42, "", "   ", "Also Valid"],
      });

      const result = await suggestCategories("fi-4");

      expect(result.categories).toEqual(["Valid", "Also Valid"]);
      expect(result.reasoning).toBe("");
      expect(result.feedbackItemId).toBe("fi-4");
    });

    it("caps the number of suggested categories at 5", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue({
        id: "fi-5",
        title: "x",
        rawContent: "x",
        authorLogin: null,
        source: "RSS",
        analysis: null,
      });
      mockChatJson.mockResolvedValue({
        categories: ["a", "b", "c", "d", "e", "f", "g"],
        reasoning: "too many",
      });

      const result = await suggestCategories("fi-5");

      expect(result.categories).toHaveLength(5);
      expect(result.categories).toEqual(["a", "b", "c", "d", "e"]);
    });
  });

  describe("batchSuggestCategories", () => {
    it("returns results and isolates failures so one bad item doesn't abort the run", async () => {
      // fi-1 succeeds, fi-2 is missing (throws), fi-3 has an LLM error.
      mockFeedbackItem.findUnique
        .mockResolvedValueOnce({
          id: "fi-1",
          title: "Login broken",
          rawContent: "redirect loop",
          authorLogin: "alice",
          source: "GitHubIssues",
          analysis: null,
        })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: "fi-3",
          title: "x",
          rawContent: "x",
          authorLogin: null,
          source: "RSS",
          analysis: null,
        });

      mockChatJson
        .mockResolvedValueOnce({ categories: ["Login Redirect Loop"], reasoning: "r1" })
        .mockRejectedValueOnce(new Error("LLM down"));

      const { results, failures } = await batchSuggestCategories([
        "fi-1",
        "fi-2",
        "fi-3",
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        feedbackItemId: "fi-1",
        categories: ["Login Redirect Loop"],
        reasoning: "r1",
      });

      expect(failures).toHaveLength(2);
      const failedIds = failures.map((f) => f.feedbackItemId).sort();
      expect(failedIds).toEqual(["fi-2", "fi-3"]);
      const fi2 = failures.find((f) => f.feedbackItemId === "fi-2");
      expect(fi2?.error).toContain("not found");
      const fi3 = failures.find((f) => f.feedbackItemId === "fi-3");
      expect(fi3?.error).toContain("LLM down");
    });

    it("returns empty results and failures for an empty input list", async () => {
      const { results, failures } = await batchSuggestCategories([]);
      expect(results).toEqual([]);
      expect(failures).toEqual([]);
      expect(mockFeedbackItem.findUnique).not.toHaveBeenCalled();
      expect(mockChatJson).not.toHaveBeenCalled();
    });

    it("reports all items as failures when every suggestion fails", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);

      const { results, failures } = await batchSuggestCategories([
        "a",
        "b",
      ]);

      expect(results).toEqual([]);
      expect(failures).toHaveLength(2);
      expect(failures.every((f) => f.error.includes("not found"))).toBe(true);
    });
  });

  describe("buildCategorizationPrompt", () => {
    it("includes existing topics and action items when present", () => {
      const prompt = buildCategorizationPrompt(
        {
          title: "T",
          rawContent: "content",
          authorLogin: "alice",
          source: "GitHubIssues",
        },
        {
          sentiment: "negative",
          severityScore: 3,
          summary: "Sum.",
          emotion: "frustrated",
          topics: ["Bug Report", "Performance"],
          actionItems: ["Do A", "Do B"],
        }
      );
      expect(prompt).toContain('Existing topics: "Bug Report", "Performance"');
      expect(prompt).toContain('Action items: "Do A", "Do B"');
    });

    it("omits topics/action items lines when arrays are empty", () => {
      const prompt = buildCategorizationPrompt(
        {
          title: null,
          rawContent: "content",
          authorLogin: null,
          source: "RSS",
        },
        {
          sentiment: "positive",
          severityScore: 1,
          summary: "Nice.",
          emotion: "happy",
          topics: [],
          actionItems: [],
        }
      );
      expect(prompt).not.toContain("Existing topics:");
      expect(prompt).not.toContain("Action items:");
    });

    it("truncates very long raw content", () => {
      const long = "x".repeat(10_000);
      const prompt = buildCategorizationPrompt(
        { title: null, rawContent: long, authorLogin: null, source: "RSS" },
        null
      );
      // 4000 chars of content + surrounding prompt text.
      expect(prompt.length).toBeLessThan(long.length);
      expect(prompt).toContain("x".repeat(4000));
    });
  });

  describe("SMART_CATEGORIZATION_SYSTEM_PROMPT", () => {
    it("instructs the model to act as a categorization expert and return JSON", () => {
      expect(SMART_CATEGORIZATION_SYSTEM_PROMPT).toContain(
        "feedback categorization expert"
      );
      expect(SMART_CATEGORIZATION_SYSTEM_PROMPT).toContain("1-5");
      expect(SMART_CATEGORIZATION_SYSTEM_PROMPT).toContain("categories");
      expect(SMART_CATEGORIZATION_SYSTEM_PROMPT).toContain("reasoning");
      expect(SMART_CATEGORIZATION_SYSTEM_PROMPT).toContain("JSON");
    });
  });
});
