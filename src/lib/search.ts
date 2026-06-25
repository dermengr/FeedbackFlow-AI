import { prisma } from "@/lib/prisma";

// Full-text search service backed by PostgreSQL tsvector / ts_rank.
// Relies on the GIN index on
//   to_tsvector('english', coalesce("title", '') || ' ' || coalesce("rawContent", ''))
// on the feedback_items table.

export interface SearchResult {
  id: string;
  title: string | null;
  rawContent: string;
  externalId: string;
  url: string | null;
  sentiment: string | null;
  summary: string | null;
  tsRank: number;
}

interface SearchRow {
  id: string;
  title: string | null;
  rawContent: string;
  externalId: string;
  url: string | null;
  sentiment: string | null;
  summary: string | null;
  ts_rank: number;
}

interface CountRow {
  count: bigint | number;
}

/**
 * Full-text search over feedback items using PostgreSQL tsvector.
 *
 * Returns a page of results ranked by ts_rank, plus the total match count.
 * An empty/whitespace query short-circuits and returns empty results without
 * touching the database.
 */
export async function searchFeedback(
  query: string,
  page: number,
  pageSize: number
): Promise<{ results: SearchResult[]; total: number }> {
  const trimmed = query?.trim() ?? "";
  if (!trimmed) {
    return { results: [], total: 0 };
  }

  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const offset = (safePage - 1) * safePageSize;

  // Use tagged template literals so Prisma parameterizes the values safely.
  const rows = await prisma.$queryRaw<SearchRow[]>`
    SELECT
      fi.id,
      fi.title,
      fi."rawContent",
      fi."externalId",
      fi.url,
      fa.sentiment,
      fa.summary,
      ts_rank(
        to_tsvector('english', coalesce(fi.title, '') || ' ' || coalesce(fi."rawContent", '')),
        plainto_tsquery('english', ${trimmed})
      ) AS ts_rank
    FROM feedback_items fi
    LEFT JOIN feedback_analyses fa ON fa.feedback_item_id = fi.id
    WHERE to_tsvector('english', coalesce(fi.title, '') || ' ' || coalesce(fi."rawContent", ''))
          @@ plainto_tsquery('english', ${trimmed})
    ORDER BY ts_rank DESC
    LIMIT ${safePageSize} OFFSET ${offset}
  `;

  const countRows = await prisma.$queryRaw<CountRow[]>`
    SELECT COUNT(*) AS count
    FROM feedback_items fi
    WHERE to_tsvector('english', coalesce(fi.title, '') || ' ' || coalesce(fi."rawContent", ''))
          @@ plainto_tsquery('english', ${trimmed})
  `;

  const total = countRows.length > 0 ? Number(countRows[0].count) : 0;

  const results: SearchResult[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    rawContent: row.rawContent,
    externalId: row.externalId,
    url: row.url,
    sentiment: row.sentiment,
    summary: row.summary,
    tsRank: Number(row.ts_rank),
  }));

  return { results, total };
}
