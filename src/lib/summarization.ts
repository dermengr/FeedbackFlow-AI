// Feedback Summarization
//
// Generates a concise summary report for a batch of feedback items using the
// local LLM. The summary includes an executive summary, key findings, a
// sentiment breakdown, top issues, and recommendations.
//
// Used by:
//   - POST /api/summarize
//   - <FeedbackSummary /> client component

import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

// Maximum number of feedback items that can be summarized in a single call.
// Keeps the prompt within token limits and bounds cost.
export const MAX_SUMMARY_ITEMS = 50;

const SUMMARIZATION_SYSTEM_PROMPT =
  "You are a product analyst. Summarize these customer feedback items into a concise report. Return JSON with {executiveSummary: string, keyFindings: string[], sentimentBreakdown: {positive, neutral, negative}, topIssues: string[], recommendations: string[]}";

export interface SentimentBreakdown {
  positive: number;
  neutral: number;
  negative: number;
}

export interface FeedbackSummaryResult {
  executiveSummary: string;
  keyFindings: string[];
  sentimentBreakdown: SentimentBreakdown;
  topIssues: string[];
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateSummaryItemIds(
  ids: unknown
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids)) {
    return { ok: false, error: "feedbackItemIds must be an array" };
  }
  if (ids.length === 0) {
    return { ok: false, error: "feedbackItemIds must not be empty" };
  }
  if (ids.length > MAX_SUMMARY_ITEMS) {
    return {
      ok: false,
      error: `feedbackItemIds must contain at most ${MAX_SUMMARY_ITEMS} items`,
    };
  }
  for (const id of ids) {
    if (typeof id !== "string" || id.length === 0) {
      return {
        ok: false,
        error: "feedbackItemIds must contain non-empty strings",
      };
    }
  }
  return { ok: true, ids: ids as string[] };
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

// Build the user prompt sent to the LLM. Includes each feedback item's title,
// raw content, source, author, and its analysis (summary, sentiment, topics,
// severity, emotion, action items) so the model can reason across the batch.
// Exported for unit testing.
export function buildSummaryUserPrompt(
  items: Array<{
    id: string;
    source: string;
    title: string | null;
    rawContent: string;
    authorLogin: string | null;
    originalTimestamp: Date;
    analysis?: {
      sentiment: string;
      topics: unknown;
      severityScore: number;
      summary: string;
      emotion: string | null;
      actionItems: unknown;
    } | null;
  }>
): string {
  const payload = items.map((item, i) => {
    const topics = Array.isArray(item.analysis?.topics)
      ? (item.analysis!.topics as unknown[]).filter(
          (t): t is string => typeof t === "string"
        )
      : [];
    const actionItems = Array.isArray(item.analysis?.actionItems)
      ? (item.analysis!.actionItems as unknown[]).filter(
          (t): t is string => typeof t === "string"
        )
      : [];
    return {
      item: i + 1,
      id: item.id,
      source: item.source,
      title: item.title ?? null,
      author: item.authorLogin ?? null,
      content: item.rawContent,
      timestamp: item.originalTimestamp.toISOString(),
      analysis: item.analysis
        ? {
            sentiment: item.analysis.sentiment,
            topics,
            severityScore: item.analysis.severityScore,
            summary: item.analysis.summary,
            emotion: item.analysis.emotion ?? null,
            actionItems,
          }
        : null,
    };
  });

  return JSON.stringify(
    {
      totalItems: items.length,
      feedbackItems: payload,
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

// Defensively normalize the LLM output so the UI always has the expected
// shape, even if the model omits or mistypes a field.
export function normalizeSummaryResult(
  result: Partial<FeedbackSummaryResult>
): FeedbackSummaryResult {
  const sb = (result.sentimentBreakdown ?? {}) as Partial<SentimentBreakdown>;
  const num = (v: unknown): number =>
    typeof v === "number" && !Number.isNaN(v) ? v : 0;
  return {
    executiveSummary:
      typeof result.executiveSummary === "string"
        ? result.executiveSummary
        : "",
    keyFindings: Array.isArray(result.keyFindings) ? result.keyFindings : [],
    sentimentBreakdown: {
      positive: num(sb.positive),
      neutral: num(sb.neutral),
      negative: num(sb.negative),
    },
    topIssues: Array.isArray(result.topIssues) ? result.topIssues : [],
    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations
      : [],
  };
}

// ---------------------------------------------------------------------------
// Core summarization
// ---------------------------------------------------------------------------

// Summarize a batch of feedback items by id.
// 1. Validate the provided ids.
// 2. Fetch the FeedbackItems with their analyses.
// 3. Build a compact context and send to the LLM via chatJson.
// 4. Normalize and return the result.
export async function summarizeFeedback(
  feedbackItemIds: string[]
): Promise<FeedbackSummaryResult> {
  const validation = validateSummaryItemIds(feedbackItemIds);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const items = await prisma.feedbackItem.findMany({
    where: { id: { in: validation.ids } },
    include: {
      analysis: {
        select: {
          sentiment: true,
          topics: true,
          severityScore: true,
          summary: true,
          emotion: true,
          actionItems: true,
        },
      },
    },
  });

  if (items.length === 0) {
    throw new Error("No feedback items found for the provided ids");
  }

  const userPrompt = buildSummaryUserPrompt(items);

  const result = await chatJson<FeedbackSummaryResult>(
    SUMMARIZATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.3, maxAttempts: 2 }
  );

  return normalizeSummaryResult(result);
}

// Compute the start date for a "last N days" window. Returns null when days is
// non-positive so callers can omit the filter entirely.
export function rangeStartDate(days: number): Date | null {
  if (typeof days !== "number" || !Number.isFinite(days) || days <= 0) {
    return null;
  }
  const start = new Date();
  start.setTime(start.getTime() - days * 24 * 60 * 60 * 1000);
  return start;
}

// Summarize all feedback items from a given source within the last `days` days.
export async function summarizeBySource(
  source: string,
  days: number
): Promise<FeedbackSummaryResult> {
  if (!source || typeof source !== "string") {
    throw new Error("source must be a non-empty string");
  }
  const start = rangeStartDate(days);
  const where = {
    source,
    ...(start ? { originalTimestamp: { gte: start } } : {}),
  };

  const items = await prisma.feedbackItem.findMany({
    where,
    include: {
      analysis: {
        select: {
          sentiment: true,
          topics: true,
          severityScore: true,
          summary: true,
          emotion: true,
          actionItems: true,
        },
      },
    },
    orderBy: { originalTimestamp: "desc" },
    take: MAX_SUMMARY_ITEMS,
  });

  if (items.length === 0) {
    throw new Error(
      `No feedback items found for source "${source}" in the last ${days} days`
    );
  }

  const userPrompt = buildSummaryUserPrompt(items);

  const result = await chatJson<FeedbackSummaryResult>(
    SUMMARIZATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.3, maxAttempts: 2 }
  );

  return normalizeSummaryResult(result);
}

// Summarize all feedback items whose analysis topics include `topic` within the
// last `days` days.
export async function summarizeByTopic(
  topic: string,
  days: number
): Promise<FeedbackSummaryResult> {
  if (!topic || typeof topic !== "string") {
    throw new Error("topic must be a non-empty string");
  }
  const start = rangeStartDate(days);

  // Filter on the FeedbackAnalysis side via the relation. The `topics` column
  // is JSON, so we use string_contains as a simple substring match.
  const items = await prisma.feedbackItem.findMany({
    where: {
      analysis: {
        topics: { string_contains: topic },
        ...(start ? { createdAt: { gte: start } } : {}),
      },
    },
    include: {
      analysis: {
        select: {
          sentiment: true,
          topics: true,
          severityScore: true,
          summary: true,
          emotion: true,
          actionItems: true,
        },
      },
    },
    orderBy: { originalTimestamp: "desc" },
    take: MAX_SUMMARY_ITEMS,
  });

  if (items.length === 0) {
    throw new Error(
      `No feedback items found for topic "${topic}" in the last ${days} days`
    );
  }

  const userPrompt = buildSummaryUserPrompt(items);

  const result = await chatJson<FeedbackSummaryResult>(
    SUMMARIZATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.3, maxAttempts: 2 }
  );

  return normalizeSummaryResult(result);
}
