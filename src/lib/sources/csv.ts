import Papa from "papaparse";
import { RawFeedbackItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// A3: CSV bulk upload adapter
//
// Parses a CSV string with columns: title, content, author, url, timestamp
// (timestamp optional; defaults to now). Produces RawFeedbackItem[] ready
// for the standard ingest pipeline.
//
// Used by POST /api/ingest/upload (manual upload from the UI).
// ---------------------------------------------------------------------------

export const CSV_SOURCE = "CSVUpload";

export interface CsvRow {
  title?: string;
  content?: string;
  author?: string;
  url?: string;
  timestamp?: string;
}

export interface CsvParseResult {
  items: RawFeedbackItem[];
  errors: Array<{ row: number; error: string }>;
}

export function parseCsvUpload(
  csvText: string,
  sourceLabel = CSV_SOURCE
): CsvParseResult {
  const result = Papa.parse<CsvRow>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const items: RawFeedbackItem[] = [];
  const errors: Array<{ row: number; error: string }> = [];

  result.data.forEach((row, idx) => {
    const lineNo = idx + 2; // +1 for header, +1 for 0-index
    const content = (row.content ?? "").trim();
    if (!content) {
      errors.push({ row: lineNo, error: "Missing required 'content' field" });
      return;
    }
    const tsRaw = (row.timestamp ?? "").trim();
    let ts: Date;
    if (tsRaw) {
      ts = new Date(tsRaw);
      if (isNaN(ts.getTime())) {
        errors.push({ row: lineNo, error: `Invalid timestamp: "${tsRaw}"` });
        return;
      }
    } else {
      ts = new Date();
    }

    const title = (row.title ?? "").trim() || null;
    const author = (row.author ?? "").trim() || null;
    const url = (row.url ?? "").trim() || null;
    const externalId = `csv:${Date.now()}:${idx}:${title?.slice(0, 20) ?? "untitled"}`;

    items.push({
      source: sourceLabel,
      externalId,
      title,
      rawContent: content.slice(0, 8000),
      authorLogin: author,
      url,
      originalTimestamp: ts,
    });
  });

  return { items, errors };
}
