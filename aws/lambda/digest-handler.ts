// AWS Lambda entrypoint for the daily digest email cron (Cron Pattern B).
// Triggered by EventBridge (schedule: rate(1 day)).
//
// This file imports the same `runDigest` orchestration used by the local
// script and the /api/digest route, so behavior is identical across
// environments. Build it with `npm run digest:lambda` (esbuild bundle).
//
// Environment variables (set on the Lambda function via SAM/Console or
// SecretsManager): DATABASE_URL, DIGEST_SMTP_URL, DIGEST_FROM, DIGEST_TO,
// NEXTAUTH_URL

import type { APIGatewayProxyResult, ScheduledEvent } from "aws-lambda";
import { runDigest } from "../../src/lib/digest";

export const handler = async (
  _event: ScheduledEvent
): Promise<APIGatewayProxyResult> => {
  console.log("FeedbackFlow digest Lambda invoked by EventBridge schedule.");

  try {
    const result = await runDigest();
    console.log("Digest result:", JSON.stringify(result));

    const statusCode =
      result.status === "FAILURE" ? 500 : result.status === "DISABLED" ? 200 : 200;

    return {
      statusCode,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Digest Lambda crashed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (err as Error).message }),
    };
  }
};
