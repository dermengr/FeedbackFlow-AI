// Local cron runner: `npm run unsnooze`
// Clears all feedback snoozes whose `snoozedUntil` timestamp is in the past,
// mirroring what the scheduled AWS Lambda job does so you can test it locally.

import "dotenv/config";
import { clearExpiredSnoozes } from "@/lib/snooze";

async function main() {
  console.log("=== FeedbackFlow AI - local unsnooze run ===");
  const count = await clearExpiredSnoozes();
  console.log(`=== Unsnoozed ${count} expired item(s) ===`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Unsnooze runner crashed:", err);
  process.exit(1);
});
