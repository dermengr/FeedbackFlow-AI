// AWS Lambda entrypoint for the daily ingest cron.
// Triggered by EventBridge (schedule: rate(1 day)).
//
// This file imports the same `runIngest` orchestration used by the local
// script and the /api/ingest route, so behavior is identical across
// environments. Build it with `npm run ingest:lambda` (esbuild bundle).
//
// Environment variables (set on the Lambda function via SAM/Console or
// SecretsManager): DATABASE_URL, OPENAI_API_KEY, OPENAI_MODEL, GITHUB_REPO,
// GITHUB_TOKEN, INGEST_LOOKBACK_HOURS, INGEST_MAX_ITEMS, SLACK_WEBHOOK_URL

import type { APIGatewayProxyResult, ScheduledEvent } from "aws-lambda";
import { runIngest } from "../../src/lib/ingest";

export const handler = async (
  _event: ScheduledEvent
): Promise<APIGatewayProxyResult> => {
  console.log("FeedbackFlow ingest Lambda invoked by EventBridge schedule.");

  try {
    const result = await runIngest();
    console.log("Ingest result:", JSON.stringify(result));

    const statusCode =
      result.status === "FAILURE" ? 500 : result.status === "PARTIAL" ? 207 : 200;

    return {
      statusCode,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Ingest Lambda crashed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
