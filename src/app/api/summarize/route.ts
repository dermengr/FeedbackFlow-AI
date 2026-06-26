import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { getRequestAuth, unauthorizedResponse } from "@/lib/request-auth";
import {
  summarizeFeedback,
  summarizeBySource,
  summarizeByTopic,
  validateSummaryItemIds,
} from "@/lib/summarization";

// POST /api/summarize
// Body: { feedbackItemIds?: string[], source?: string, topic?: string, days?: number }
// Generates a concise summary report for a batch of feedback items via the
// local LLM. At least one filter must be provided:
//   - feedbackItemIds: explicit list of item ids to summarize, OR
//   - source: summarize all items from a source in the last `days` days, OR
//   - topic: summarize all items tagged with a topic in the last `days` days.
export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as {
    feedbackItemIds?: unknown;
    source?: unknown;
    topic?: unknown;
    days?: unknown;
  };

  const hasIds = Array.isArray(b.feedbackItemIds) && b.feedbackItemIds.length > 0;
  const hasSource = typeof b.source === "string" && b.source.length > 0;
  const hasTopic = typeof b.topic === "string" && b.topic.length > 0;

  // At least one filter must be provided.
  if (!hasIds && !hasSource && !hasTopic) {
    return NextResponse.json(
      {
        error:
          "At least one of feedbackItemIds, source, or topic must be provided",
      },
      { status: 400 }
    );
  }

  // Normalize days: must be a positive finite number when provided.
  let days = 7;
  if (b.days !== undefined && b.days !== null) {
    const parsed = Number(b.days);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return NextResponse.json(
        { error: "days must be a positive number" },
        { status: 400 }
      );
    }
    days = parsed;
  }

  try {
    // feedbackItemIds takes precedence when provided.
    if (hasIds) {
      const validation = validateSummaryItemIds(b.feedbackItemIds);
      if (!validation.ok) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const summary = await summarizeFeedback(validation.ids);
      return NextResponse.json({ summary });
    }

    if (hasSource) {
      const summary = await summarizeBySource(b.source as string, days);
      return NextResponse.json({ summary });
    }

    const summary = await summarizeByTopic(b.topic as string, days);
    return NextResponse.json({ summary });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
