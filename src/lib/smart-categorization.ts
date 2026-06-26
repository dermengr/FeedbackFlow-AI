import { prisma } from "@/lib/prisma";
import { chatJson } from "@/lib/llm";

// ---------------------------------------------------------------------------
// Smart Categorization
//
// The standard topic taxonomy (see TOPIC_TAXONOMY in @/lib/types) covers broad
// categories like "Bug Report", "Feature Request", "Performance", etc. This
// module uses the local LLM to suggest *custom* category labels that go beyond
// the standard taxonomy — e.g. "Onboarding Friction", "Pricing Confusion",
// "Mobile Sync Race Condition" — so teams can build a richer, product-specific
// labeling scheme driven by actual feedback content.
//
// All LLM calls go through `chatJson` from @/lib/llm (Ollama by default,
// OpenAI fallback), keeping provider config centralized.
// ---------------------------------------------------------------------------

// System prompt instructing the local LLM to suggest custom category labels.
// Kept as a module-level constant so tests can assert against it.
export const SMART_CATEGORIZATION_SYSTEM_PROMPT =
  "You are a feedback categorization expert. Given customer feedback, suggest 1-5 specific category labels that go beyond standard topics. Return JSON with {categories: string[], reasoning: string}";

export class FeedbackItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Feedback item not found: ${id}`);
    this.name = "FeedbackItemNotFoundError";
  }
}

export interface CategorySuggestions {
  categories: string[];
  reasoning: string;
}

export interface SuggestResult extends CategorySuggestions {
  feedbackItemId: string;
}

/**
 * Build the user prompt sent to the LLM for category suggestion.
 *
 * Includes the feedback metadata, the structured analysis (sentiment /
 * severity / summary / emotion / action items / existing topics) and the raw
 * content so the model has enough context to propose specific, useful labels.
 * Exported so tests can verify prompt construction without invoking the LLM.
 */
export function buildCategorizationPrompt(
  item: {
    title: string | null;
    rawContent: string;
    authorLogin: string | null;
    source: string;
  },
  analysis: {
    sentiment: string;
    severityScore: number;
    summary: string;
    emotion: string | null;
    topics: unknown;
    actionItems: unknown;
  } | null
): string {
  const meta = [
    `Source: ${item.source}`,
    item.authorLogin ? `Author: ${item.authorLogin}` : null,
    item.title ? `Title: ${item.title}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const analysisLines = analysis
    ? [
        `Sentiment: ${analysis.sentiment}`,
        `Severity (1-5): ${analysis.severityScore}`,
        `Summary: ${analysis.summary}`,
        analysis.emotion ? `Detected emotion: ${analysis.emotion}` : null,
        formatJsonArray("Existing topics", analysis.topics),
        formatJsonArray("Action items", analysis.actionItems),
      ]
        .filter(Boolean)
        .join("\n")
    : "No structured analysis available.";

  // Truncate raw content to limit prompt size / cost / attack surface.
  const truncated = item.rawContent.slice(0, 4000);

  return [
    "Suggest custom category labels for the following customer feedback.",
    "The labels should be specific and go beyond generic topics like 'Bug Report' or 'Feature Request'.",
    "",
    meta,
    "",
    "Analysis:",
    analysisLines,
    "",
    "Original feedback:",
    "<feedback>",
    truncated,
    "</feedback>",
  ].join("\n");
}

function formatJsonArray(label: string, value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items = value.filter((i): i is string => typeof i === "string").slice(0, 6);
  if (items.length === 0) return null;
  return `${label}: ${items.map((i) => `"${i}"`).join(", ")}`;
}

function normalizeSuggestions(raw: unknown): CategorySuggestions {
  if (!raw || typeof raw !== "object") {
    return { categories: [], reasoning: "" };
  }
  const obj = raw as Record<string, unknown>;
  const categories = Array.isArray(obj.categories)
    ? obj.categories.filter((c): c is string => typeof c === "string" && c.trim().length > 0).map((c) => c.trim()).slice(0, 5)
    : [];
  const reasoning =
    typeof obj.reasoning === "string" ? obj.reasoning.trim() : "";
  return { categories, reasoning };
}

/**
 * Suggest custom category labels for a single feedback item.
 *
 * Fetches the FeedbackItem together with its FeedbackAnalysis from Prisma,
 * builds a prompt from the analysis and raw content, then calls the local LLM
 * via `chatJson`. The LLM's JSON response is normalized into a safe shape.
 *
 * @returns The suggested categories and reasoning.
 * @throws {FeedbackItemNotFoundError} if no FeedbackItem exists for the id.
 */
export async function suggestCategories(
  feedbackItemId: string
): Promise<SuggestResult> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  if (!item) {
    throw new FeedbackItemNotFoundError(feedbackItemId);
  }

  const userPrompt = buildCategorizationPrompt(
    {
      title: item.title,
      rawContent: item.rawContent,
      authorLogin: item.authorLogin,
      source: item.source,
    },
    item.analysis
      ? {
          sentiment: item.analysis.sentiment,
          severityScore: item.analysis.severityScore,
          summary: item.analysis.summary,
          emotion: item.analysis.emotion,
          topics: item.analysis.topics,
          actionItems: item.analysis.actionItems,
        }
      : null
  );

  const raw = await chatJson<unknown>(
    SMART_CATEGORIZATION_SYSTEM_PROMPT,
    userPrompt,
    { temperature: 0.3 }
  );

  const suggestions = normalizeSuggestions(raw);
  return { ...suggestions, feedbackItemId };
}

export interface BatchSuggestResult {
  results: SuggestResult[];
  failures: Array<{ feedbackItemId: string; error: string }>;
}

/**
 * Suggest categories for many feedback items, isolating failures so one bad
 * item (missing record, LLM error, malformed JSON) doesn't abort the run.
 */
export async function batchSuggestCategories(
  feedbackItemIds: string[]
): Promise<BatchSuggestResult> {
  const results: BatchSuggestResult["results"] = [];
  const failures: BatchSuggestResult["failures"] = [];

  for (const id of feedbackItemIds) {
    try {
      const suggestion = await suggestCategories(id);
      results.push(suggestion);
    } catch (err) {
      failures.push({
        feedbackItemId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { results, failures };
}

/**
 * Merge suggested category labels with the labels already assigned to a
 * feedback item.
 *
 * Returns the union of existing label names and the suggested categories,
 * de-duplicated case-insensitively (preserving the first-seen casing). This is
 * useful for showing users which suggested labels are net-new vs. already
 * applied.
 *
 * @throws {FeedbackItemNotFoundError} if no FeedbackItem exists for the id.
 */
export async function mergeWithExistingLabels(
  itemId: string,
  suggestedCategories: string[]
): Promise<string[]> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: itemId },
    select: { id: true, labels: { include: { label: true } } },
  });

  if (!item) {
    throw new FeedbackItemNotFoundError(itemId);
  }

  const existingNames = item.labels.map((fl) => fl.label.name);

  const merged: string[] = [];
  const seen = new Set<string>();

  for (const name of [...existingNames, ...suggestedCategories]) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(name);
  }

  return merged;
}
