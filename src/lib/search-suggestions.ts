import { prisma } from "@/lib/prisma";

// Smart Search Suggestions service.
//
// Builds autocomplete-style suggestions from two signals:
//   1. The user's own search history (substring-matched against the partial).
//   2. Popular topics extracted from FeedbackAnalysis.topics (a JSON array).
//
// The two lists are combined and de-duplicated (case-insensitive) so the UI can
// render "Recent" and "Popular" sections while also offering a single merged
// list for keyboard navigation.

export interface Suggestions {
  history: string[];
  popular: string[];
  combined: string[];
}

// Maximum number of suggestions pulled from each signal.
const HISTORY_LIMIT = 5;
const POPULAR_LIMIT = 5;

// Cap on the number of analyses scanned when computing popular topics. Keeps
// the in-JS aggregation cheap while still reflecting recent feedback trends.
const POPULAR_SCAN_LIMIT = 500;

type AnalysisTopicRow = { topics: unknown };

/**
 * Extract a list of topic strings from a FeedbackAnalysis.topics JSON value.
 * The schema stores topics as a JSON array of strings, but we guard against
 * malformed data defensively.
 */
function extractTopics(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const t of value) {
    if (typeof t === "string" && t.trim().length > 0) {
      out.push(t.trim());
    }
  }
  return out;
}

/**
 * Return suggestions for a partial query.
 *
 * - `history`: up to 5 of the user's past searches whose query contains the
 *   partial (case-insensitive), most-recent first.
 * - `popular`: up to 5 most-frequent topics across recent analyses.
 * - `combined`: history followed by popular, with case-insensitive de-dup.
 *
 * An empty/whitespace partial still returns popular topics (useful for an
 * empty-state dropdown) but skips the history substring query.
 */
export async function getSuggestions(
  userId: string,
  partial: string
): Promise<Suggestions> {
  const trimmed = (partial ?? "").trim();

  // --- History: substring match on the user's past queries -----------------
  let history: string[] = [];
  if (trimmed.length > 0) {
    const rows = await prisma.searchHistory.findMany({
      where: {
        userId,
        query: { contains: trimmed, mode: "insensitive" },
      },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
      select: { query: true },
    });
    // De-dup history by case-insensitive value, preserving recency order.
    const seen = new Set<string>();
    for (const r of rows) {
      const key = r.query.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        history.push(r.query);
      }
    }
  }

  // --- Popular: aggregate topics from recent analyses ----------------------
  const analyses = await prisma.feedbackAnalysis.findMany({
    select: { topics: true },
    orderBy: { createdAt: "desc" },
    take: POPULAR_SCAN_LIMIT,
  });

  // Count topic frequency by lowercase key, but remember the first-seen
  // original casing so the UI can display topics as they were stored.
  const counts = new Map<string, number>();
  const casing = new Map<string, string>();
  for (const a of analyses as AnalysisTopicRow[]) {
    for (const topic of extractTopics(a.topics)) {
      const key = topic.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!casing.has(key)) casing.set(key, topic);
    }
  }

  const popularCased = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, POPULAR_LIMIT)
    .map(([key]) => casing.get(key) ?? key);

  // --- Combine & de-dup ----------------------------------------------------
  const combined: string[] = [];
  const combinedSeen = new Set<string>();
  for (const s of [...history, ...popularCased]) {
    const key = s.toLowerCase();
    if (!combinedSeen.has(key)) {
      combinedSeen.add(key);
      combined.push(s);
    }
  }

  return { history, popular: popularCased, combined };
}

/**
 * Persist a search to the user's SearchHistory.
 *
 * Trims the query and ignores empty/whitespace-only strings so we don't log
 * noise. `resultsCount` defaults to 0 when not provided.
 */
export async function recordSearch(
  userId: string,
  query: string,
  resultsCount = 0
): Promise<void> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return;

  await prisma.searchHistory.create({
    data: {
      userId,
      query: trimmed,
      resultsCount: Math.max(0, Math.floor(resultsCount) || 0),
    },
  });
}

/**
 * Return the user's most recent unique searches, most-recent first.
 *
 * Uniqueness is case-insensitive: only the first (most recent) occurrence of
 * each query is kept.
 */
export async function getRecentSearches(
  userId: string,
  limit = 10
): Promise<string[]> {
  const safeLimit = Math.max(1, Math.floor(limit) || 1);

  const rows = await prisma.searchHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: safeLimit * 4, // over-fetch to de-dup, then trim to `limit`
    select: { query: true },
  });

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const key = r.query.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r.query);
      if (out.length >= safeLimit) break;
    }
  }
  return out;
}
