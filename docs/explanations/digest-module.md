# Deep-Dive: Email Digest Module (Cron Pattern B)

## File: `src/lib/digest.ts`

## Role in Architecture

The digest module lives in the **Service Layer** alongside `ingest.ts`, `llm.ts`, `github.ts`, `slack.ts`, `auth.ts`, and `prisma.ts`. It implements **Cron Pattern B** — a daily email digest that summarizes the triage state of all feedback in the system.

While Cron Pattern A (the ingest pipeline) focuses on *acquiring* new feedback, Cron Pattern B focuses on *communicating* the current state to the team. The digest email includes:

- Total feedback count and status breakdown (NEW / ACKNOWLEDGED / ACTIONED)
- Sentiment distribution (positive / neutral / negative)
- High-severity items needing attention (severity >= 4, not yet Actioned)
- Recent new feedback from the last 24 hours

## Internal Structure

The module exports five functions:

| Function | Lines | Purpose |
|---|---|---|
| `isDigestEnabled()` | 22-24 | Feature-flag check: returns `true` if `DIGEST_SMTP_URL` and `DIGEST_FROM` are both set |
| `buildDigestSummary()` | 42-97 | Queries Prisma for aggregated metrics (groupBy status, sentiment), high-severity items, and recent new feedback |
| `renderDigestHtml(summary)` | 104-155 | Renders the `DigestSummary` into a styled HTML email body with tables |
| `sendEmail({ to, subject, html })` | 165-225 | Sends an email via raw SMTP using Node's `net`/`tls` modules (no nodemailer dependency) |
| `runDigest(opts?)` | 233-270 | Orchestrator: checks enabled → builds summary → renders HTML → sends email → returns `DigestResult` |

## External Connections

### Imports
- `@/lib/prisma` — Prisma client singleton for database queries
- Node built-in `net` and `tls` modules (dynamically imported in `sendEmail`)

### Called by
- `aws/lambda/digest-handler.ts` — AWS Lambda entry point triggered by EventBridge
- `scripts/digest.ts` — Local CLI runner (`npm run digest`)
- `src/app/api/digest/route.ts` — Manual trigger API endpoint (`POST /api/digest`)

### Configured by
- `.env.example` — `DIGEST_SMTP_URL`, `DIGEST_FROM`, `DIGEST_TO` environment variables

## Data Flow

```
EventBridge (rate 1 day)
  → Lambda digest-handler.ts
    → runDigest()
      → isDigestEnabled() check
      → buildDigestSummary()
        → prisma.feedbackAnalysis.groupBy([status])
        → prisma.feedbackAnalysis.groupBy([sentiment])
        → prisma.feedbackAnalysis.findMany({ severityScore >= 4, status != ACTIONED })
        → prisma.feedbackAnalysis.findMany({ status: NEW, createdAt >= 24h ago })
      → renderDigestHtml(summary)
        → HTML string with styled tables
      → sendEmail({ to: DIGEST_TO, subject, html })
        → Parse SMTP URL (smtp(s)://user:pass@host:port)
        → Connect via net/tls
        → EHLO → AUTH LOGIN (if credentials) → MAIL FROM → RCPT TO → DATA → QUIT
      → return DigestResult { status, recipient, itemsIncluded }
```

## Key Patterns

### 1. Feature Flagging
The digest is disabled by default. It only activates when both `DIGEST_SMTP_URL` and `DIGEST_FROM` are set. This allows the same codebase to run with or without email capabilities — important for local development and testing.

### 2. Zero-Dependency SMTP
Instead of adding `nodemailer` (which would increase the Lambda bundle size), the module implements a minimal SMTP client using Node's built-in `net` and `tls` modules. It handles:
- Both `smtp:` (port 587) and `smtps:` (port 465) protocols
- AUTH LOGIN with base64-encoded credentials
- 15-second connection timeout
- Sequential command/response protocol

### 3. HTML Email Rendering
The `renderDigestHtml` function produces a complete HTML document with inline CSS (required for email clients). It uses a warm color scheme matching the app's branding and includes conditional sections:
- High-severity table only renders if items exist
- Recent feedback table only renders if items exist
- Empty-state messages when no data is available

### 4. Graceful Degradation
`runDigest` returns a `DigestResult` with status `DISABLED`, `SUCCESS`, or `FAILURE`. The Lambda handler maps these to HTTP status codes (200 for DISABLED/SUCCESS, 500 for FAILURE), ensuring the Lambda never crashes — failures are caught and returned as structured JSON.

## AWS Deployment

The SAM template (`aws/template.yaml`) provisions:

- **DigestFunction** — `AWS::Serverless::Function` with esbuild bundling, VPC config (same subnets/security group as the ingest Lambda), and environment variables (DATABASE_URL, DIGEST_SMTP_URL, DIGEST_FROM, DIGEST_TO, NEXTAUTH_URL)
- **DigestSchedule** — `AWS::Events::Rule` with `ScheduleExpression: rate(1 day)`
- **DigestSchedulePermission** — `AWS::Lambda::Permission` allowing EventBridge to invoke the function
- **DigestFailureAlarm** — `AWS::CloudWatch::Alarm` monitoring Lambda errors

## Testing

The `renderDigestHtml` function is tested in `src/lib/__tests__/digest.test.ts` with 9 test cases covering:
- Complete HTML document structure
- Total item count inclusion
- Status breakdown table with all statuses
- Sentiment distribution table
- High-severity section (populated and empty)
- Recent feedback section (populated and empty)
- Link presence when URLs are available

## How It Satisfies the Project Brief

The brief's "User-Queued Actions (Cron Pattern B)" bonus requires:
> Allow users to "triage" feedback by assigning a status (New, Acknowledged, Actioned). A second daily cron job could dispatch a summary email digest.

This module implements the "summary email digest" part. The triage status assignment is handled by `src/components/StatusSelect.tsx` and the `PATCH /api/feedback/[id]` endpoint. Together, they complete the Cron Pattern B bonus.
