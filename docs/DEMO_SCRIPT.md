# FeedbackFlow AI — Demo Video Script

This document is a step-by-step recording guide for the demo video required by
the project brief. The video should be 3-5 minutes long and cover all four
required evidence items.

## Pre-Recording Checklist

Before recording, ensure the following are deployed and running:

- [ ] AWS Amplify app deployed with a **custom domain** connected (e.g. `feedbackflow.dev` or similar)
- [ ] AWS SAM stack deployed (RDS Postgres + 2 Lambda functions + 2 EventBridge schedules)
- [ ] At least one successful ingest run has been executed (data exists in the database)
- [ ] CloudWatch log groups exist for both Lambda functions
- [ ] Optional: Slack webhook configured (for the severity >= 4 notification demo)
- [ ] Optional: SMTP configured for digest email (for the Cron Pattern B demo)

## Recording Script

### Section 1: Intro (15 seconds)

> "This is FeedbackFlow AI, an automated micro-SaaS platform that ingests,
> analyzes, and triages real-world customer feedback using LLMs. It pulls
> GitHub Issues from a public repository, runs multi-task LLM analysis on each
> item, and presents the results in a dashboard and inbox for Product Managers
> and Customer Success teams."

**On screen:** Title card with the FeedbackFlow AI logo/name.

---

### Section 2: Amplify Dashboard + Custom Domain (45 seconds)

**Required by brief:** "The Amplify dashboard showing the deployed app and domain connection."

1. Open the AWS Amplify console in the browser
2. Show the FeedbackFlow AI app in the list
3. Click into the app → show the deployment status (green/verified)
4. Navigate to "Domain management" → show the custom domain connected (e.g. `feedbackflow.dev`)
5. Show the SSL certificate status (Verified)
6. Click the domain link → the app loads in a new tab
7. Show the login page

> "The frontend is hosted on AWS Amplify with a custom domain. The app is
> built automatically from the repository via the amplify.yml build spec,
> which runs npm ci, prisma generate, and next build."

---

### Section 3: Auth + UI Walkthrough (60 seconds)

1. On the login page, enter demo credentials:
   - Email: `demo@feedbackflow.dev`
   - Password: `password123`
2. Click "Sign in" → redirect to the dashboard
3. **Dashboard:** Show KPI cards (total feedback, sentiment breakdown), sentiment trend chart, sentiment donut, topic distribution bar chart, severity distribution, recent high-severity list
4. **Inbox:** Click "Inbox" in the navbar → show the filterable/sortable table
5. Demonstrate filtering by sentiment (e.g. select "negative")
6. Demonstrate sorting by severity (descending)
7. **Detail View:** Click a feedback item → show raw content alongside the structured AI analysis (sentiment, topics, severity, summary)
8. **Triage:** Use the StatusSelect dropdown to change status from "NEW" to "ACKNOWLEDGED" → show it persists on refresh

> "The UI provides a dashboard with sentiment trends and topic distribution
> charts, a filterable and sortable inbox, and a detail view showing the raw
> feedback alongside the structured LLM analysis. Users can triage items by
> assigning status: New, Acknowledged, or Actioned."

---

### Section 4: Cron Execution — EventBridge → Lambda → DB (60 seconds)

**Required by brief:** "A successful cron execution (EventBridge → Lambda → DB update)."

1. Open the AWS Lambda console
2. Show the `IngestFunction` (or the SAM-generated name)
3. Click "Monitor" tab → show recent invocations
4. Open CloudWatch Logs → show a successful execution log:
   - `[ingest] run <uuid> starting for source=GitHubIssues`
   - `[ingest] fetched N items`
   - `[ingest] N new, M skipped (duplicate)`
   - `[ingest] persisted=N failures=0`
5. Open the EventBridge console → show the `IngestSchedule` rule with `rate(1 day)`
6. **Trigger a manual ingest** to show new data appearing:
   - Option A: Use the AWS Lambda "Test" button with a scheduled event payload
   - Option B: `curl -X POST https://feedbackflow.dev/api/ingest` with a session cookie
7. Refresh the dashboard → show new items appeared
8. Open the RDS console → show the `feedback_items` and `feedback_analyses` tables have new rows (via query editor or psql)

> "The daily cron is implemented via AWS Lambda triggered by EventBridge on a
> rate of one day. The Lambda invokes the same runIngest pipeline used locally,
> which fetches new GitHub Issues, deduplicates by external ID, calls OpenAI
> for structured analysis, and stores the results in RDS Postgres. The IngestLog
> table records every run for reliability tracking."

---

### Section 5: Cloud Services Overview (45 seconds)

**Required by brief:** "Any other cloud service used, explaining its usability."

1. **RDS Postgres** — Show the database instance, mention it's in a VPC with private subnets
2. **Secrets Manager** — Show the `feedbackflow/db` secret storing DB credentials
3. **CloudWatch Alarms** — Show the `FeedbackFlowIngestFailure` and `FeedbackFlowDigestFailure` alarms
4. **VPC** — Show the VPC with NAT Gateway for Lambda outbound access to GitHub/OpenAI
5. **EventBridge (Digest)** — Show the second schedule for the daily digest email (Cron Pattern B)

> "The backend uses several AWS services: RDS Postgres for the database in a
> private VPC, Secrets Manager for credential management, CloudWatch alarms
> for monitoring Lambda failures, and a second EventBridge schedule for the
> daily digest email — a bonus feature that sends a summary of triage status
> and high-severity items to the team."

---

### Section 6: Bonus Features (30 seconds)

1. **Slack webhook:** Show a Slack channel with a high-severity notification (if configured)
   > "When feedback with severity 4 or higher is detected, a Slack notification
   > is sent automatically via an outgoing webhook."

2. **Email digest:** Show the digest Lambda in the console, and optionally show a received email
   > "A second daily cron sends an email digest summarizing all feedback by
   > status, sentiment, and severity, highlighting items that need attention."

3. **Idempotency:** Trigger the ingest again → show `itemsNew: 0, itemsSkipped: N`
   > "The ingest is idempotent — re-running it skips items already processed,
   thanks to the unique constraint on external_id."

---

### Section 7: Closing (15 seconds)

> "FeedbackFlow AI is built with Next.js 14, NextAuth, Prisma, OpenAI, and
> deployed entirely on AWS. The codebase includes unit tests, comprehensive
> documentation, and follows security best practices with all secrets loaded
> from environment variables. Thank you for watching."

**On screen:** GitHub repository URL + tech stack summary.

---

## Total Estimated Duration: ~4 minutes

## Recording Tips

- Use a screen recording tool (e.g. Loom, OBS, QuickTime)
- Record at 1080p minimum
- Speak clearly and at a moderate pace
- Highlight the cursor when clicking through the UI
- Keep the AWS console in "light mode" for better visibility
- If a live ingest takes too long, pre-run it and show the logs after
- Have the demo data seeded beforehand (`npm run seed -- --with-samples`)
