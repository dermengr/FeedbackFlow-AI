// Local runner for the daily digest email (Cron Pattern B).
// Run: `npm run digest`
//
// Requires: DATABASE_URL, DIGEST_SMTP_URL, DIGEST_FROM, DIGEST_TO in .env

import "dotenv/config";
import { runDigest } from "../src/lib/digest";

async function main() {
  const result = await runDigest();
  console.log("Digest result:", JSON.stringify(result, null, 2));
  process.exit(result.status === "FAILURE" ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
