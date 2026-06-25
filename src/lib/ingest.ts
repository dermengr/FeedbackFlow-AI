import { prisma } from "@/lib/prisma";
import { fetchGitHubIssues, GITHUB_SOURCE } from "@/lib/github";
import { analyzeBatch } from "@/lib/llm";
import { notifyHighSeverity } from "@/lib/slack";
import { RawFeedbackItem } from "@/lib/types";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Ingest orchestration: fetch -> dedupe (idempotency) -> LLM analyze -> store
// -> Slack notify (severity >= 4) -> write IngestLog.
//
// Used by:
//   - scripts/ingest.ts (local cron runner)
//   - aws/lambda/handler.ts (AWS Lambda + EventBridge daily cron)
//   - POST /api/ingest (manual trigger from the UI)
// ---------------------------------------------------------------------------

export interface IngestResult {
  runId: string;
  source: string;
  status: "SUCCESS" | "PARTIAL" | "FAILURE";
  itemsFetched: number;
  itemsNew: number;
  itemsSkipped: number;
  failures: Array<{ externalId: string; error: string }>;
  error?: string;
}

const HIGH_SEVERITY_THRESHOLD = 4;

export interface IngestOptions {
  // Allow tests / manual triggers to override the source fetcher.
  fetcher?: () => Promise<RawFeedbackItem[]>;
  source?: string;
}

export async function runIngest(opts: IngestOptions = {}): Promise<IngestResult> {
  const runId = randomUUID();
  const source = opts.source ?? GITHUB_SOURCE;
  const fetcher = opts.fetcher ?? fetchGitHubIssues;

  const result: IngestResult = {
    runId,
    source,
    status: "SUCCESS",
    itemsFetched: 0,
    itemsNew: 0,
    itemsSkipped: 0,
    failures: [],
  };

  console.log(`[ingest] run ${runId} starting for source=${source}`);

  // 1. Fetch raw feedback (with retry/backoff handled inside the fetcher).
  let rawItems: RawFeedbackItem[] = [];
  try {
    rawItems = await fetcher();
    result.itemsFetched = rawItems.length;
    console.log(`[ingest] fetched ${rawItems.length} items`);
  } catch (err) {
    const msg = (err as Error).message;
    console.error(`[ingest] fetch failed: ${msg}`);
    result.status = "FAILURE";
    result.error = `fetch failed: ${msg}`;
    await persistLog(result);
    return result;
  }

  if (rawItems.length === 0) {
    console.log(`[ingest] no new items, finishing`);
    await persistLog(result);
    return result;
  }

  // 2. Dedupe against already-stored externalIds (idempotency). The unique
  //    constraint on externalId is the ultimate guard, but pre-filtering saves
  //    LLM calls.
  const externalIds = rawItems.map((i) => i.externalId);
  const existing = await prisma.feedbackItem.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });
  const existingSet = new Set(existing.map((e) => e.externalId));
  const newItems = rawItems.filter((i) => !existingSet.has(i.externalId));
  result.itemsSkipped = rawItems.length - newItems.length;
  result.itemsFetched = rawItems.length;
  console.log(
    `[ingest] ${newItems.length} new, ${result.itemsSkipped} skipped (duplicate)`
  );

  if (newItems.length === 0) {
    await persistLog(result);
    return result;
  }

  // 3. LLM analysis (batch, failures isolated).
  const { results, failures } = await analyzeBatch(newItems);
  result.failures = failures.map((f) => ({
    externalId: f.item.externalId,
    error: f.error,
  }));

  // 4. Persist items + analyses. We upsert per item so a partial run can be
  //    re-run safely. Each item+analysis pair is its own transaction so one
  //    failure doesn't roll back the whole batch.
  let persisted = 0;
  for (const { item, analysis } of results) {
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.feedbackItem.create({
          data: {
            source: item.source,
            externalId: item.externalId,
            title: item.title ?? null,
            rawContent: item.rawContent,
            authorLogin: item.authorLogin ?? null,
            url: item.url ?? null,
            originalTimestamp: item.originalTimestamp,
          },
        });
        await tx.feedbackAnalysis.create({
          data: {
            feedbackItemId: created.id,
            sentiment: analysis.sentiment,
            topics: analysis.topics,
            severityScore: analysis.severity_score,
            summary: analysis.summary,
            language: analysis.language,
            translatedSummary: analysis.translatedSummary,
            emotion: analysis.emotion,
            actionItems: analysis.actionItems,
            status: "NEW",
          },
        });
      });
      persisted++;

      // 5. Slack notify on high severity (best-effort, never fails the run).
      if (analysis.severity_score >= HIGH_SEVERITY_THRESHOLD) {
        try {
          await notifyHighSeverity({
            externalId: item.externalId,
            title: item.title,
            url: item.url,
            sentiment: analysis.sentiment,
            topics: analysis.topics,
            severityScore: analysis.severity_score,
            summary: analysis.summary,
          });
        } catch (e) {
          console.warn(`[ingest] slack notify failed: ${(e as Error).message}`);
        }
      }
    } catch (err) {
      // Unique constraint race / DB error -> record as failure, continue.
      result.failures.push({
        externalId: item.externalId,
        error: `persist failed: ${(err as Error).message}`,
      });
    }
  }

  result.itemsNew = persisted;
  console.log(
    `[ingest] persisted=${persisted} failures=${result.failures.length}`
  );

  // 6. Determine overall status.
  if (result.failures.length > 0 && persisted === 0) {
    result.status = "FAILURE";
    result.error = `${result.failures.length} failures, 0 persisted`;
  } else if (result.failures.length > 0) {
    result.status = "PARTIAL";
  } else {
    result.status = "SUCCESS";
  }

  await persistLog(result);
  return result;
}

async function persistLog(result: IngestResult): Promise<void> {
  try {
    await prisma.ingestLog.create({
      data: {
        runId: result.runId,
        source: result.source,
        status: result.status,
        itemsFetched: result.itemsFetched,
        itemsNew: result.itemsNew,
        itemsSkipped: result.itemsSkipped,
        error: result.error ?? (result.failures.length ? JSON.stringify(result.failures) : null),
      },
    });
  } catch (err) {
    // Logging must never fail the run.
    console.error(`[ingest] failed to write ingest log: ${(err as Error).message}`);
  }
}
