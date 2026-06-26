import { prisma } from "@/lib/prisma";
import { chatCompletion } from "@/lib/llm";

// System prompt instructing the local LLM to act as a customer support agent.
// Kept as a module-level constant so tests can assert against it.
export const REPLY_SYSTEM_PROMPT =
  "You are a customer support agent. Write a professional, empathetic reply to this customer feedback. Be concise and actionable.";

export class FeedbackItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Feedback item not found: ${id}`);
    this.name = "FeedbackItemNotFoundError";
  }
}

/**
 * Build the user prompt sent to the LLM for reply generation.
 *
 * The prompt summarizes the feedback using the stored analysis (sentiment,
 * severity, summary, emotion, action items) plus the raw content so the model
 * has enough context to write a relevant, empathetic reply. Exported so tests
 * can verify prompt construction without invoking the LLM.
 */
export function buildReplyPrompt(
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
        formatActionItems(analysis.actionItems),
      ]
        .filter(Boolean)
        .join("\n")
    : "No structured analysis available.";

  // Truncate raw content to limit prompt size / cost.
  const truncated = item.rawContent.slice(0, 4000);

  return [
    "Write a reply to the customer who submitted the following feedback.",
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

function formatActionItems(actionItems: unknown): string | null {
  if (!Array.isArray(actionItems) || actionItems.length === 0) return null;
  const items = actionItems
    .filter((i): i is string => typeof i === "string")
    .slice(0, 5);
  if (items.length === 0) return null;
  return `Action items: ${items.map((i) => `"${i}"`).join(", ")}`;
}

/**
 * Generate a suggested support reply for a feedback item.
 *
 * Fetches the FeedbackItem together with its FeedbackAnalysis from Prisma,
 * builds a prompt from the analysis (sentiment / severity / summary) and the
 * raw feedback content, then calls the local LLM via `chatCompletion`.
 *
 * @returns The generated reply text.
 * @throws {FeedbackItemNotFoundError} if no FeedbackItem exists for the id.
 */
export async function generateReply(feedbackItemId: string): Promise<string> {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: feedbackItemId },
    include: { analysis: true },
  });

  if (!item) {
    throw new FeedbackItemNotFoundError(feedbackItemId);
  }

  const userPrompt = buildReplyPrompt(item, item.analysis);

  const reply = await chatCompletion(REPLY_SYSTEM_PROMPT, userPrompt, {
    temperature: 0.4,
  });

  return reply.trim();
}
