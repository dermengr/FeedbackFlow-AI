import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock feedbackItem model we control from each test.
const { mockFeedbackItem } = vi.hoisted(() => ({
  mockFeedbackItem: {
    findUnique: vi.fn(),
  },
}));

// Mock the LLM chatCompletion so no network/provider call is made.
const { mockChatCompletion } = vi.hoisted(() => ({
  mockChatCompletion: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackItem: mockFeedbackItem,
  },
}));

vi.mock("@/lib/llm", () => ({
  chatCompletion: mockChatCompletion,
}));

import {
  generateReply,
  buildReplyPrompt,
  REPLY_SYSTEM_PROMPT,
  FeedbackItemNotFoundError,
} from "@/lib/reply-gen";

beforeEach(() => {
  mockFeedbackItem.findUnique.mockReset();
  mockChatCompletion.mockReset();
});

describe("reply-gen", () => {
  describe("generateReply", () => {
    it("fetches the item with its analysis and returns the LLM reply", async () => {
      const item = {
        id: "fi-1",
        title: "Login broken",
        rawContent: "I can't log in, it keeps redirecting.",
        authorLogin: "alice",
        source: "GitHubIssues",
        analysis: {
          sentiment: "negative",
          severityScore: 4,
          summary: "User reports a login redirect loop.",
          emotion: "frustrated",
          actionItems: ["Fix login redirect loop"],
        },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockChatCompletion.mockResolvedValue("  Thanks for reporting!  ");

      const reply = await generateReply("fi-1");

      expect(mockFeedbackItem.findUnique).toHaveBeenCalledWith({
        where: { id: "fi-1" },
        include: { analysis: true },
      });
      expect(mockChatCompletion).toHaveBeenCalledTimes(1);
      expect(reply).toBe("Thanks for reporting!");
    });

    it("passes the system prompt and a user prompt built from the analysis", async () => {
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
          actionItems: ["Fix crash"],
        },
      };
      mockFeedbackItem.findUnique.mockResolvedValue(item);
      mockChatCompletion.mockResolvedValue("Sorry to hear that.");

      await generateReply("fi-1");

      expect(mockChatCompletion).toHaveBeenCalledWith(
        REPLY_SYSTEM_PROMPT,
        expect.any(String),
        expect.objectContaining({ temperature: 0.4 })
      );

      const userPrompt = mockChatCompletion.mock.calls[0][1] as string;
      expect(userPrompt).toContain("Sentiment: negative");
      expect(userPrompt).toContain("Severity (1-5): 5");
      expect(userPrompt).toContain("Summary: Crash on startup.");
      expect(userPrompt).toContain("Detected emotion: angry");
      expect(userPrompt).toContain("App crashes on startup.");
      expect(userPrompt).toContain("Source: Reddit");
      expect(userPrompt).toContain("Author: bob");
      expect(userPrompt).toContain("Title: Bug");
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
      mockChatCompletion.mockResolvedValue("Thank you so much!");

      const reply = await generateReply("fi-2");

      expect(reply).toBe("Thank you so much!");
      const userPrompt = mockChatCompletion.mock.calls[0][1] as string;
      expect(userPrompt).toContain("No structured analysis available.");
      // Should not include analysis lines.
      expect(userPrompt).not.toContain("Sentiment:");
    });

    it("throws FeedbackItemNotFoundError when the item does not exist", async () => {
      mockFeedbackItem.findUnique.mockResolvedValue(null);

      await expect(generateReply("missing")).rejects.toBeInstanceOf(
        FeedbackItemNotFoundError
      );
      expect(mockChatCompletion).not.toHaveBeenCalled();
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
      mockChatCompletion.mockRejectedValue(new Error("LLM down"));

      await expect(generateReply("fi-3")).rejects.toThrow("LLM down");
    });
  });

  describe("buildReplyPrompt", () => {
    it("includes action items when present", () => {
      const prompt = buildReplyPrompt(
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
          actionItems: ["Do A", "Do B"],
        }
      );
      expect(prompt).toContain('Action items: "Do A", "Do B"');
    });

    it("omits the action items line when the array is empty", () => {
      const prompt = buildReplyPrompt(
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
          actionItems: [],
        }
      );
      expect(prompt).not.toContain("Action items:");
    });

    it("truncates very long raw content", () => {
      const long = "x".repeat(10_000);
      const prompt = buildReplyPrompt(
        { title: null, rawContent: long, authorLogin: null, source: "RSS" },
        null
      );
      // 4000 chars of content + surrounding prompt text.
      expect(prompt.length).toBeLessThan(long.length);
      expect(prompt).toContain("x".repeat(4000));
    });
  });

  describe("REPLY_SYSTEM_PROMPT", () => {
    it("instructs the model to be a professional, empathetic support agent", () => {
      expect(REPLY_SYSTEM_PROMPT).toContain("customer support agent");
      expect(REPLY_SYSTEM_PROMPT).toContain("empathetic");
      expect(REPLY_SYSTEM_PROMPT).toContain("concise");
      expect(REPLY_SYSTEM_PROMPT).toContain("actionable");
    });
  });
});
