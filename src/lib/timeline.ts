import { prisma } from "@/lib/prisma";
import type { Sentiment } from "@/lib/types";

// A single day bucket in the feedback timeline.
export interface TimelineDay {
  // ISO date string (YYYY-MM-DD) for the calendar day.
  date: string;
  // Total number of feedback items received that day.
  total: number;
  // Count of items analyzed as positive that day.
  positive: number;
  // Count of items analyzed as neutral that day.
  neutral: number;
  // Count of items analyzed as negative that day.
  negative: number;
}

// Aggregate summary across the whole queried window.
export interface TimelineSummary {
  // Total feedback items across all days in the window.
  totalItems: number;
  // Average items per day across the window (totalItems / days).
  avgPerDay: number;
  // ISO date string (YYYY-MM-DD) of the day with the most items.
  // null when there is no data.
  peakDay: string | null;
  // Item count on the peak day. 0 when there is no data.
  peakCount: number;
}

export interface TimelineData {
  days: TimelineDay[];
  summary: TimelineSummary;
}

// A row consumed by the pure grouping logic: the originalTimestamp of a
// FeedbackItem plus the (optional) sentiment of its linked analysis. Keeping
// this shape decoupled from Prisma makes groupByDay trivially testable with
// plain arrays. Items without an analysis still count toward `total` but do
// not contribute to any sentiment bucket.
export interface TimelineInputItem {
  date: Date;
  sentiment?: string;
}

function isSentiment(value: unknown): value is Sentiment {
  return value === "positive" || value === "neutral" || value === "negative";
}

// Format a Date as a calendar-day key in YYYY-MM-DD form, using the local
// timezone of the runtime. This keeps days stable regardless of hour-of-day.
function dayKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Pure grouping logic: given an array of {date, sentiment?} items, bucket each
// into a per-day entry keyed by calendar day (YYYY-MM-DD). Each entry counts
// the total number of items for that day plus per-sentiment counts (positive,
// neutral, negative). Items whose sentiment is missing or not one of the three
// canonical values still count toward `total` but not toward any sentiment
// bucket. Invalid dates (NaN) are skipped.
//
// The returned array is sorted chronologically by date ascending.
export function groupByDay(items: TimelineInputItem[]): TimelineDay[] {
  const buckets = new Map<string, TimelineDay>();

  for (const item of items) {
    const ts = item.date instanceof Date ? item.date : new Date(item.date);
    const time = ts.getTime();
    if (!Number.isFinite(time)) continue; // skip invalid dates

    const key = dayKey(ts);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { date: key, total: 0, positive: 0, neutral: 0, negative: 0 };
      buckets.set(key, bucket);
    }

    bucket.total += 1;
    if (isSentiment(item.sentiment)) {
      bucket[item.sentiment] += 1;
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// Compute aggregate summary stats from a list of day buckets. avgPerDay is
// computed against the provided window size (`days`) so days with zero items
// are still accounted for. peakDay/peakCount identify the busiest day; when
// there is no data peakDay is null and peakCount is 0.
export function summarizeTimeline(days: TimelineDay[], windowDays: number): TimelineSummary {
  let totalItems = 0;
  let peakDay: string | null = null;
  let peakCount = 0;

  for (const d of days) {
    totalItems += d.total;
    if (d.total > peakCount) {
      peakCount = d.total;
      peakDay = d.date;
    }
  }

  const denom = windowDays > 0 ? windowDays : 1;
  const avgPerDay = totalItems / denom;

  return {
    totalItems,
    avgPerDay,
    peakDay,
    peakCount,
  };
}

// Fetch FeedbackItems within the last `days` days (optionally filtered to a
// single source) and return a per-day timeline of feedback activity grouped
// by the FeedbackItem.originalTimestamp. Sentiment counts come from the joined
// FeedbackAnalysis; items without an analysis still count toward `total`.
export async function getTimelineData(days: number = 30, source?: string): Promise<TimelineData> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const items = await prisma.feedbackItem.findMany({
    where: {
      originalTimestamp: { gte: cutoff },
      ...(source ? { source } : {}),
    },
    select: {
      originalTimestamp: true,
      analysis: { select: { sentiment: true } },
    },
    orderBy: { originalTimestamp: "asc" },
  });

  const rows: TimelineInputItem[] = items.map((i) => ({
    date: i.originalTimestamp,
    sentiment: i.analysis?.sentiment,
  }));

  const dayBuckets = groupByDay(rows);
  const summary = summarizeTimeline(dayBuckets, days);

  return { days: dayBuckets, summary };
}
