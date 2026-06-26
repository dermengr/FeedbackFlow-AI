// Root Cause Analysis
//
// Given a group of related feedback items, the local LLM analyzes their
// analyses (summaries, sentiments, topics) to identify underlying root causes,
// recurring patterns, and recommended actions.
//
// Used by:
//   - POST /api/root-cause
//   - <RootCauseAnalysis /> client component

import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

// Maximum number of feedback items that can be analyzed in a single call.
// Keeps the prompt within token limits and bounds cost.
export const MAX_ROOT_CAUSE_ITEMS = 20;

const ROOT_CAUSE_SYSTEM_PROMPT =
  "You are a senior engineering manager. Analyze these related customer feedback items and identify root causes. Return JSON with {rootCauses: string[], patterns: string[], recommendedActions: string[], confidence: number}";

export interface RootCauseResult {
  rootCauses: string[];
  patterns: string[];
  recommendedActions: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateRootCauseItemIds(
  ids: unknown
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!Array.isArray(ids)) {
    return { ok: false, error: "feedbackItemIds must be an array" };
  }
  if (ids.length === 0) {
    return { ok: false, error: "feedbackItemIds must not be empty" };
  }
  if (ids.length > MAX_ROOT_CAUSE_ITEMS) {
    return {
      ok: false,
      error: `feedbackItemIds must contain at most ${MAX_ROOT_CAUSE_ITEMS} items`,
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

// Build the user prompt sent to the LLM. Groups the feedback items and
// includes their summaries, sentiments, and topics so the model can reason
// about root causes across the set. Exported for unit testing.
export function buildRootCauseUserPrompt(
  items: Array<{
    id: string;
    title: string | null;
    summary: string | null;
    sentiment: string | null;
    topics: unknown;
  }>
): string {
  const payload = items.map((item, i) => {
    const topics = Array.isArray(item.topics)
      ? (item.topics as unknown[]).filter(
          (t): t is string => typeof t === "string"
        )
      : [];
    return {
      item: i + 1,
      title: item.title ?? null,
      summary: item.summary ?? null,
      sentiment: item.sentiment ?? null,
      topics,
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
// Core analysis
// ---------------------------------------------------------------------------

// Analyze a group of related feedback items to identify root causes.
// 1. Fetch the specified FeedbackItems along with their FeedbackAnalysis.
// 2. Group them and build a compact context (summaries + sentiments + topics).
// 3. Send to the LLM via chatJson with the root-cause system prompt.
// 4. Normalize the result defensively and return it.
export async function analyzeRootCause(
  feedbackItemIds: string[]
): Promise<RootCauseResult> {
  const validation = validateRootCauseItemIds(feedbackItemIds);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  // Fetch the feedback items with their analyses in a single query.
  const items = await prisma.feedbackItem.findMany({
    where: { id: { in: validation.ids } },
    include: {
      analysis: {
        select: {
          sentiment: true,
          topics: true,
          summary: true,
        },
      },
    },
  });

  if (items.length === 0) {
    throw new Error("No feedback items found for the provided ids");
  }

  // Flatten into the shape expected by the prompt builder.
  const grouped = items.map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.analysis?.summary ?? null,
    sentiment: item.analysis?.sentiment ?? null,
    topics: item.analysis?.topics ?? [],
  }));

  const userPrompt = buildRootCauseUserPrompt(grouped);

  const result = await chatJson<RootCauseResult>(
    ROOT_CAUSE_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.3, maxAttempts: 2 }
  );

  // Normalize / defensively fill missing fields so the UI always has arrays
  // and a sane confidence value.
  const normalized: RootCauseResult = {
    rootCauses: Array.isArray(result.rootCauses) ? result.rootCauses : [],
    patterns: Array.isArray(result.patterns) ? result.patterns : [],
    recommendedActions: Array.isArray(result.recommendedActions)
      ? result.recommendedActions
      : [],
    confidence:
      typeof result.confidence === "number" && !Number.isNaN(result.confidence)
        ? Math.max(0, Math.min(1, result.confidence))
        : 0,
  };

  return normalized;
}

// Convenience wrapper: returns the root cause analysis for the given item ids.
// No caching is performed — each call re-runs the analysis.
export async function getRootCauseAnalysis(
  itemIds: string[]
): Promise<RootCauseResult> {
  return analyzeRootCause(itemIds);
}
