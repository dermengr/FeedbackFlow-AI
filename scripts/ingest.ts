// Local cron runner: `npm run ingest`
// Mirrors what the AWS Lambda handler does, so you can test the daily ingest
// job locally without deploying.

import "dotenv/config";
import { runIngest } from "@/lib/ingest";

async function main() {
  console.log("=== FeedbackFlow AI - local ingest run ===");
  const result = await runIngest();
  console.log("=== Result ===");
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.status === "FAILURE" ? 1 : 0);
}

main().catch((err) => {
  console.error("Ingest runner crashed:", err);
  process.exit(1);
});
