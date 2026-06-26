import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VolumeAnomaly {
  date: string;
  count: number;
  expected: number;
  deviation: number;
}

export interface SentimentAnomaly {
  date: string;
  negativeRate: number;
  expectedRate: number;
  deviation: number;
}

export interface AnomalySummary {
  totalAnomalies: number;
  lastAnomalyDate: string | null;
}

export interface AnomalyResult {
  volumeAnomalies: VolumeAnomaly[];
  sentimentAnomalies: SentimentAnomaly[];
  summary: AnomalySummary;
}

export interface RollingStats {
  avg: number;
  stddev: number;
  zscores: number[];
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

// Compute rolling statistics over a trailing window of `windowSize` elements.
//
// For each position i the window is values[max(0, i - windowSize + 1) .. i]
// (inclusive of the current element). The returned `avg` and `stddev` describe
// the final (most recent) window, while `zscores` holds the per-position
// z-score against that position's own trailing window. Population standard
// deviation is used (divide by n, not n-1).
//
// Edge cases:
//   - empty input     -> { avg: 0, stddev: 0, zscores: [] }
//   - window > length -> stats computed over all available values
//   - stddev === 0    -> z-score for that position is 0 (no dispersion)
export function calculateRollingStats(
  values: number[],
  windowSize: number
): RollingStats {
  if (!Array.isArray(values) || values.length === 0) {
    return { avg: 0, stddev: 0, zscores: [] };
  }

  const n = values.length;
  const safeWindow = Math.max(1, Math.floor(windowSize));
  const zscores: number[] = [];

  for (let i = 0; i < n; i++) {
    const start = Math.max(0, i - safeWindow + 1);
    const window = values.slice(start, i + 1);
    const avg = window.reduce((acc, v) => acc + v, 0) / window.length;
    const variance =
      window.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) / window.length;
    const stddev = Math.sqrt(variance);
    zscores.push(stddev === 0 ? 0 : (values[i] - avg) / stddev);
  }

  // Stats for the final (most recent) trailing window.
  const lastStart = Math.max(0, n - safeWindow);
  const lastWindow = values.slice(lastStart);
  const avg = lastWindow.reduce((acc, v) => acc + v, 0) / lastWindow.length;
  const variance =
    lastWindow.reduce((acc, v) => acc + (v - avg) * (v - avg), 0) /
    lastWindow.length;
  const stddev = Math.sqrt(variance);

  return { avg, stddev, zscores };
}

// Return true when `value` exceeds `avg + threshold * stddev`. A value exactly
// at the threshold is NOT considered a spike (strictly greater). When stddev is
// 0 the comparison collapses to `value > avg`.
export function detectSpike(
  value: number,
  avg: number,
  stddev: number,
  threshold: number = 2
): boolean {
  return value > avg + threshold * stddev;
}

// ---------------------------------------------------------------------------
// DB-backed detection
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const ROLLING_WINDOW = 7;
const SPIKE_THRESHOLD = 2;

// Format a Date as a stable YYYY-MM-DD string (UTC) for bucket keys.
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Round to 2 decimal places, guarding against NaN/Infinity.
function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

// Detect unusual spikes in daily feedback volume and in the daily negative
// sentiment rate over the last `days` days.
//
// To establish a baseline, twice the requested window (`days * 2`) of history
// is queried. For each day a rolling 7-day baseline is computed from the
// *prior* 7 days (excluding the day being evaluated), and the day is flagged
// when its value exceeds `avg + 2 * stddev`.
//
// Volume anomalies come from FeedbackItem.originalTimestamp buckets; sentiment
// anomalies come from FeedbackAnalysis.createdAt buckets (negative rate =
// negative analyses / total analyses that day).
export async function detectAnomalies(
  days: number = 30
): Promise<AnomalyResult> {
  const windowDays = Math.max(1, Math.floor(days));
  const totalDays = windowDays * 2;
  const now = Date.now();
  const start = now - totalDays * DAY_MS;

  // --- Volume: daily feedback counts -------------------------------------
  const items = await prisma.feedbackItem.findMany({
    where: { originalTimestamp: { gte: new Date(start) } },
    select: { originalTimestamp: true },
  });

  const counts = new Array<number>(totalDays).fill(0);
  const dateKeys: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    dateKeys.push(dayKey(new Date(start + i * DAY_MS)));
  }
  for (const it of items) {
    const idx = Math.floor(
      (it.originalTimestamp.getTime() - start) / DAY_MS
    );
    if (idx >= 0 && idx < totalDays) counts[idx] += 1;
  }

  // --- Sentiment: daily negative rate ------------------------------------
  const analyses = await prisma.feedbackAnalysis.findMany({
    where: { createdAt: { gte: new Date(start) } },
    select: { createdAt: true, sentiment: true },
  });

  const negCounts = new Array<number>(totalDays).fill(0);
  const totCounts = new Array<number>(totalDays).fill(0);
  for (const a of analyses) {
    const idx = Math.floor((a.createdAt.getTime() - start) / DAY_MS);
    if (idx >= 0 && idx < totalDays) {
      totCounts[idx] += 1;
      if (a.sentiment === "negative") negCounts[idx] += 1;
    }
  }
  const negRates = totCounts.map((t, i) => (t === 0 ? 0 : negCounts[i] / t));

  // --- Flag anomalies using a prior 7-day baseline -----------------------
  const volumeAnomalies: VolumeAnomaly[] = [];
  for (let i = 1; i < totalDays; i++) {
    const priorStart = Math.max(0, i - ROLLING_WINDOW);
    const prior = counts.slice(priorStart, i);
    const { avg, stddev } = calculateRollingStats(prior, ROLLING_WINDOW);
    if (detectSpike(counts[i], avg, stddev, SPIKE_THRESHOLD)) {
      volumeAnomalies.push({
        date: dateKeys[i],
        count: counts[i],
        expected: round2(avg),
        deviation: round2(counts[i] - avg),
      });
    }
  }

  const sentimentAnomalies: SentimentAnomaly[] = [];
  for (let i = 1; i < totalDays; i++) {
    // Skip days with no analyses: a 0 negative rate is not a meaningful spike.
    if (totCounts[i] === 0) continue;
    const priorStart = Math.max(0, i - ROLLING_WINDOW);
    const prior = negRates.slice(priorStart, i);
    const { avg, stddev } = calculateRollingStats(prior, ROLLING_WINDOW);
    if (detectSpike(negRates[i], avg, stddev, SPIKE_THRESHOLD)) {
      sentimentAnomalies.push({
        date: dateKeys[i],
        negativeRate: round2(negRates[i]),
        expectedRate: round2(avg),
        deviation: round2(negRates[i] - avg),
      });
    }
  }

  // --- Summary -----------------------------------------------------------
  const totalAnomalies = volumeAnomalies.length + sentimentAnomalies.length;
  const allDates = [
    ...volumeAnomalies.map((v) => v.date),
    ...sentimentAnomalies.map((s) => s.date),
  ];
  const lastAnomalyDate =
    allDates.length === 0 ? null : allDates.sort().slice(-1)[0] ?? null;

  return {
    volumeAnomalies,
    sentimentAnomalies,
    summary: { totalAnomalies, lastAnomalyDate },
  };
}
