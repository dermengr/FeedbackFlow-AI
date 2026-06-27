import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { isEmbeddingsEnabled } from "@/lib/embeddings";
import { clusterBySimilarity } from "@/lib/clustering";

// GET /api/feedback/clusters — group all feedback items with embeddings into
// semantic clusters using greedy single-linkage clustering. Returns clusters
// with their member item IDs, sorted by cluster size descending.
//
// Query params:
//   threshold — similarity threshold (0-1, default 0.85)
//   minSize   — minimum cluster size to include (default 2, use 1 for all)
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_FEEDBACK_READ);
  if (forbidden) return forbidden;

  if (!isEmbeddingsEnabled()) {
    return NextResponse.json({ clusters: [], enabled: false });
  }

  const url = new URL(req.url);
  const threshold = Math.min(1, Math.max(0, Number(url.searchParams.get("threshold")) || 0.85));
  const minSize = Math.max(1, Number(url.searchParams.get("minSize")) || 2);

  // Fetch all embeddings with their feedback items
  const rows = await prisma.feedbackEmbedding.findMany({
    include: {
      feedbackItem: {
        select: {
          id: true,
          title: true,
          externalId: true,
          source: true,
          analysis: { select: { sentiment: true, severityScore: true, status: true } },
        },
      },
    },
  });

  if (rows.length === 0) {
    return NextResponse.json({ clusters: [], enabled: true, count: 0 });
  }

  const items = rows.map((row) => ({
    id: row.feedbackItem.id,
    embedding: row.embedding as unknown as number[],
  }));

  const clusterIds = clusterBySimilarity(items, threshold);

  const clusters = clusterIds
    .map((ids) => {
      const members = ids.map((id) => {
        const row = rows.find((r) => r.feedbackItem.id === id)!;
        return {
          id: row.feedbackItem.id,
          title: row.feedbackItem.title,
          externalId: row.feedbackItem.externalId,
          source: row.feedbackItem.source,
          sentiment: row.feedbackItem.analysis?.sentiment ?? null,
          severity: row.feedbackItem.analysis?.severityScore ?? null,
          status: row.feedbackItem.analysis?.status ?? null,
        };
      });
      return {
        size: ids.length,
        members,
      };
    })
    .filter((c) => c.size >= minSize)
    .sort((a, b) => b.size - a.size);

  return NextResponse.json({
    clusters,
    enabled: true,
    count: clusters.length,
    totalItems: rows.length,
    threshold,
  });
}
