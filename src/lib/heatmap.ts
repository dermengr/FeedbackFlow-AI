import { prisma } from "@/lib/prisma";
import type { Sentiment } from "@/lib/types";

// One cell in the 7x24 sentiment heatmap grid.
// day: 0-6 (Sunday-Saturday, matching JS Date#getDay)
// hour: 0-23 (matching Date#getHours)
export interface HeatmapCell {
  day: number;
  hour: number;
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

// A single row consumed by the pure grouping logic: the sentiment of an
// analysis plus the originalTimestamp of its parent FeedbackItem. Keeping
// this shape decoupled from Prisma makes the grouping function trivially
// testable with plain arrays.
export interface HeatmapInputRow {
  sentiment: string;
  originalTimestamp: Date;
}

const DAYS = 7;
const HOURS = 24;

// Build an empty 7x24 grid with zeroed counts, ordered by day then hour.
export function emptyHeatmapGrid(): HeatmapCell[] {
  const grid: HeatmapCell[] = [];
  for (let day = 0; day < DAYS; day++) {
    for (let hour = 0; hour < HOURS; hour++) {
      grid.push({ day, hour, positive: 0, neutral: 0, negative: 0, total: 0 });
    }
  }
  return grid;
}

function isSentiment(value: string): value is Sentiment {
  return value === "positive" || value === "neutral" || value === "negative";
}

// Pure grouping logic: given an array of {sentiment, originalTimestamp} rows,
// bucket each into a 7x24 grid keyed by day-of-week (0-6) and hour (0-23).
// Rows whose sentiment is not one of positive/neutral/negative are ignored
// (they do not contribute to any count, including total).
// Invalid dates (NaN) are skipped.
export function groupHeatmap(rows: HeatmapInputRow[]): HeatmapCell[] {
  const grid = emptyHeatmapGrid();
  const index = (day: number, hour: number) => day * HOURS + hour;

  for (const row of rows) {
    const ts = row.originalTimestamp instanceof Date ? row.originalTimestamp : new Date(row.originalTimestamp);
    const time = ts.getTime();
    if (!Number.isFinite(time)) continue; // skip invalid dates
    if (!isSentiment(row.sentiment)) continue;

    const day = ts.getDay();
    const hour = ts.getHours();
    // Defensive bounds check (always within range for valid Date, but guard
    // against non-Date inputs that could produce odd values).
    if (day < 0 || day > 6 || hour < 0 || hour > 23) continue;

    const cell = grid[index(day, hour)];
    cell[row.sentiment] += 1;
    cell.total += 1;
  }

  return grid;
}

// Fetch FeedbackAnalysis joined with FeedbackItem from the last `days` days
// and return a 7x24 sentiment heatmap grid. Grouping is performed on the
// FeedbackItem.originalTimestamp so the heatmap reflects when feedback was
// actually submitted, not when it was analyzed.
export async function getHeatmapData(days: number = 30): Promise<HeatmapCell[]> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const analyses = await prisma.feedbackAnalysis.findMany({
    where: {
      feedbackItem: { originalTimestamp: { gte: cutoff } },
    },
    select: {
      sentiment: true,
      feedbackItem: { select: { originalTimestamp: true } },
    },
  });

  const rows: HeatmapInputRow[] = analyses.map((a) => ({
    sentiment: a.sentiment,
    originalTimestamp: a.feedbackItem.originalTimestamp,
  }));

  return groupHeatmap(rows);
}
