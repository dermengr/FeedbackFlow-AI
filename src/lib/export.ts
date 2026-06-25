// CSV export service for feedback items.

export type ExportItem = {
  externalId: string;
  source: string;
  title: string | null;
  rawContent: string;
  authorLogin: string | null;
  url: string | null;
  originalTimestamp: Date;
  analysis: {
    sentiment: string;
    topics: unknown;
    severityScore: number;
    summary: string;
    status: string;
    language: string | null;
    emotion: string | null;
  } | null;
};

const HEADERS = [
  "externalId",
  "source",
  "title",
  "author",
  "sentiment",
  "severity",
  "status",
  "topics",
  "language",
  "emotion",
  "summary",
  "url",
  "originalTimestamp",
  "rawContent",
];

/**
 * Escape a CSV value: wrap in double quotes and double any internal quotes.
 */
function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Convert a topics JSON value (expected to be a string array) into a
 * semicolon-separated string. Non-array values produce an empty string.
 */
function topicsToString(topics: unknown): string {
  if (Array.isArray(topics)) {
    return topics
      .map((t) => (typeof t === "string" ? t : String(t)))
      .join(";");
  }
  return "";
}

/**
 * Convert a single export item into a CSV row string.
 */
function itemToRow(item: ExportItem): string {
  const rawContent = item.rawContent.slice(0, 500);
  const analysis = item.analysis;
  const values: string[] = [
    item.externalId,
    item.source,
    item.title ?? "",
    item.authorLogin ?? "",
    analysis?.sentiment ?? "",
    analysis ? String(analysis.severityScore) : "",
    analysis?.status ?? "",
    topicsToString(analysis?.topics),
    analysis?.language ?? "",
    analysis?.emotion ?? "",
    analysis?.summary ?? "",
    item.url ?? "",
    item.originalTimestamp.toISOString(),
    rawContent,
  ];
  return values.map(escapeCsv).join(",");
}

/**
 * Convert a list of feedback items into a CSV string (header + rows).
 */
export function itemsToCsv(items: ExportItem[]): string {
  const rows = [HEADERS.join(",")];
  for (const item of items) {
    rows.push(itemToRow(item));
  }
  return rows.join("\n");
}
