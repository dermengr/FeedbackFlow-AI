import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { ensureEmbedding, isEmbeddingsEnabled } from "@/lib/embeddings";
import { findSimilar } from "@/lib/clustering";

// Minimum cosine similarity to be considered a semantic duplicate. Tuned
// for text-embedding-3-small: above this items are near-duplicates.
const SIMILARITY_THRESHOLD = 0.75;
const MAX_RESULTS = 5;

// GET /api/feedback/:id/similar — return the top N semantically similar
// feedback items based on embedding cosine similarity. If embeddings are
// not enabled (no OPENAI_API_KEY), returns an empty result set with
// enabled: false so the UI can degrade gracefully.
export async function GET(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_FEEDBACK_READ);
  if (forbidden) return forbidden;

  if (!isEmbeddingsEnabled()) {
    return NextResponse.json({ results: [], enabled: false });
  }

  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, rawContent: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Ensure the target item has an embedding, generating + storing it if not.
  const text = [item.title, item.rawContent].filter(Boolean).join("\n\n");
  const targetEmbedding = await ensureEmbedding(item.id, text);

  // Fetch every other embedding with its feedback item + analysis for the
  // response payload. We compute similarity in-app (no pgvector).
  const candidates = await prisma.feedbackEmbedding.findMany({
    where: { feedbackItemId: { not: item.id } },
    include: {
      feedbackItem: { include: { analysis: true } },
    },
  });

  // Use the shared findSimilar from clustering.ts
  const candidateVectors = candidates.map((row) => ({
    id: row.feedbackItem.id,
    embedding: row.embedding as unknown as number[],
  }));
  const similarIds = findSimilar(
    targetEmbedding,
    candidateVectors,
    MAX_RESULTS,
    SIMILARITY_THRESHOLD
  );

  const results = similarIds.map(({ id, similarity }) => {
    const row = candidates.find((c) => c.feedbackItem.id === id)!;
    return {
      id: row.feedbackItem.id,
      title: row.feedbackItem.title,
      externalId: row.feedbackItem.externalId,
      sentiment: row.feedbackItem.analysis?.sentiment ?? null,
      summary: row.feedbackItem.analysis?.summary ?? null,
      similarity,
      url: row.feedbackItem.url,
    };
  });

  return NextResponse.json({ results, enabled: true });
}
