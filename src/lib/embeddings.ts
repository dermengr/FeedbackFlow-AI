import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// B9: Semantic duplicate clustering via OpenAI embeddings.
//
// We use text-embedding-3-small (1536 dims) and store the vector as a JSON
// array in the FeedbackEmbedding table. Similarity is computed in-app with
// cosine similarity — no pgvector extension required.
// ---------------------------------------------------------------------------

export const EMBEDDING_MODEL = "text-embedding-3-small";

// text-embedding-3-small has a 1536-dim output. Exposed for tests / callers
// that need to reason about vector length.
export const EMBEDDING_DIMENSIONS = 1536;

// Truncate input text to stay within the model's token budget cheaply. The
// embedding endpoint accepts up to 8191 tokens; we cap at 4000 chars (well
// under that for typical text) to bound cost and latency.
const MAX_INPUT_CHARS = 4000;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  return new OpenAI({ apiKey });
}

// True when an OpenAI API key is configured, i.e. embedding features are
// available. Used by API routes to gracefully degrade when the key is absent.
export function isEmbeddingsEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

// Generate an embedding vector for the given text. Throws if the API key is
// missing or the API call fails. Input is truncated to MAX_INPUT_CHARS.
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();
  const truncated = text.slice(0, MAX_INPUT_CHARS);

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: truncated,
  });

  const embedding = response.data?.[0]?.embedding;
  if (!embedding || !Array.isArray(embedding)) {
    throw new Error("OpenAI returned no embedding in the response");
  }
  return embedding as number[];
}

// Ensure a FeedbackEmbedding row exists for the given feedback item. If one
// already exists, return the stored vector without calling OpenAI. Otherwise
// generate, persist (as a JSON array), and return the new vector.
export async function ensureEmbedding(
  feedbackItemId: string,
  text: string
): Promise<number[]> {
  const existing = await prisma.feedbackEmbedding.findUnique({
    where: { feedbackItemId },
  });
  if (existing) {
    return existing.embedding as unknown as number[];
  }

  const embedding = await generateEmbedding(text);
  await prisma.feedbackEmbedding.create({
    data: {
      feedbackItemId,
      embedding: embedding as unknown as never,
      model: EMBEDDING_MODEL,
    },
  });
  return embedding;
}

// Cosine similarity between two vectors. Returns 0 for empty/mismatched
// length vectors (defensive — shouldn't happen with a consistent model).
export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
}
