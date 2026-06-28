import { prisma } from "@/lib/prisma";

export interface SearchHistoryEntry {
  id: string;
  userId: string;
  query: string;
  resultsCount: number;
  createdAt: string;
}

/**
 * Record a search query to the user's history.
 * Empty or whitespace-only queries are ignored.
 */
export async function recordSearch(
  userId: string,
  query: string,
  resultsCount = 0
): Promise<SearchHistoryEntry> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    throw new Error("Query is required");
  }

  const created = await prisma.searchHistory.create({
    data: {
      userId,
      query: trimmed,
      resultsCount: Math.max(0, Math.floor(resultsCount) || 0),
    },
  });

  return {
    id: created.id,
    userId: created.userId,
    query: created.query,
    resultsCount: created.resultsCount,
    createdAt: created.createdAt.toISOString(),
  };
}

/**
 * Return the user's recent search history, newest first.
 */
export async function getSearchHistory(
  userId: string,
  limit = 20
): Promise<SearchHistoryEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit) || 20));

  const rows = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: safeLimit,
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    query: r.query,
    resultsCount: r.resultsCount,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * Delete all search history entries for a user.
 */
export async function clearSearchHistory(userId: string): Promise<void> {
  await prisma.searchHistory.deleteMany({
    where: { userId },
  });
}
