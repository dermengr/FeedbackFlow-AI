import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the OpenAI module + prisma. vi.hoisted ensures the mock fn references
// are initialized before the hoisted vi.mock factories execute.
const { mockCreate, mockFeedbackEmbeddingFindUnique, mockFeedbackEmbeddingCreate } =
  vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockFeedbackEmbeddingFindUnique: vi.fn(),
    mockFeedbackEmbeddingCreate: vi.fn(),
  }));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    embeddings = {
      create: mockCreate,
    };
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackEmbedding: {
      findUnique: mockFeedbackEmbeddingFindUnique,
      create: mockFeedbackEmbeddingCreate,
    },
  },
}));

beforeEach(() => {
  mockCreate.mockReset();
  mockFeedbackEmbeddingFindUnique.mockReset();
  mockFeedbackEmbeddingCreate.mockReset();
  process.env.OPENAI_API_KEY = "test-key";
});

import {
  generateEmbedding,
  ensureEmbedding,
  isEmbeddingsEnabled,
  EMBEDDING_MODEL,
} from "@/lib/embeddings";

describe("embeddings module", () => {
  describe("generateEmbedding", () => {
    it("returns the embedding vector from the OpenAI response", async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });

      const vec = await generateEmbedding("some feedback text");
      expect(vec).toEqual([0.1, 0.2, 0.3]);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      // Should pass the model and input through to the API.
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.model).toBe(EMBEDDING_MODEL);
      expect(callArg.input).toBe("some feedback text");
    });

    it("throws if OPENAI_API_KEY is missing", async () => {
      delete process.env.OPENAI_API_KEY;
      await expect(generateEmbedding("text")).rejects.toThrow(
        /OPENAI_API_KEY/
      );
    });

    it("throws if the response has no embedding", async () => {
      mockCreate.mockResolvedValue({ data: [] });
      await expect(generateEmbedding("text")).rejects.toThrow(/no embedding/);
    });

    it("truncates input text to 4000 chars", async () => {
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1] }],
      });
      const long = "x".repeat(5000);
      await generateEmbedding(long);
      const callArg = mockCreate.mock.calls[0][0];
      expect(callArg.input.length).toBe(4000);
    });
  });

  describe("isEmbeddingsEnabled", () => {
    it("returns true when OPENAI_API_KEY is set", () => {
      process.env.OPENAI_API_KEY = "test-key";
      expect(isEmbeddingsEnabled()).toBe(true);
    });

    it("returns false when OPENAI_API_KEY is unset", () => {
      delete process.env.OPENAI_API_KEY;
      expect(isEmbeddingsEnabled()).toBe(false);
    });
  });

  describe("ensureEmbedding", () => {
    it("returns the existing embedding without calling OpenAI", async () => {
      mockFeedbackEmbeddingFindUnique.mockResolvedValue({
        feedbackItemId: "item-1",
        embedding: [0.9, 0.8, 0.7],
        model: EMBEDDING_MODEL,
      });

      const vec = await ensureEmbedding("item-1", "some text");
      expect(vec).toEqual([0.9, 0.8, 0.7]);
      expect(mockFeedbackEmbeddingFindUnique).toHaveBeenCalledWith({
        where: { feedbackItemId: "item-1" },
      });
      // OpenAI must NOT be called when an embedding already exists.
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockFeedbackEmbeddingCreate).not.toHaveBeenCalled();
    });

    it("generates and stores a new embedding when none exists", async () => {
      mockFeedbackEmbeddingFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      });
      mockFeedbackEmbeddingCreate.mockResolvedValue({
        feedbackItemId: "item-2",
        embedding: [0.1, 0.2, 0.3],
        model: EMBEDDING_MODEL,
      });

      const vec = await ensureEmbedding("item-2", "new text");
      expect(vec).toEqual([0.1, 0.2, 0.3]);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockFeedbackEmbeddingCreate).toHaveBeenCalledTimes(1);
      const createArg = mockFeedbackEmbeddingCreate.mock.calls[0][0];
      expect(createArg.data.feedbackItemId).toBe("item-2");
      expect(createArg.data.model).toBe(EMBEDDING_MODEL);
    });
  });
});
