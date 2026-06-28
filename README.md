# FeedbackFlow AI

> Automated micro-SaaS to ingest, analyze, and triage real-world B2B/B2C
> public reviews using LLMs.

FeedbackFlow AI pulls in real customer feedback from public sources
(GitHub Issues API, CSV upload), runs a multi-task LLM analysis on each item
(sentiment, topics, severity, summary, impact), stores the raw + structured
results in Postgres, and presents a modern dashboard, inbox, analytics, and
triage UI for Product Managers, Customer Success, and engineering teams.

## Features

- **Auth** — secure signup/login (NextAuth, JWT sessions, bcrypt). All routes
  protected by middleware; logged-out users are redirected to `/login`.
- **LLM integration** — OpenAI `gpt-4o-mini` with structured JSON output
  (`response_format: json_object`) + zod validation + retry. Each item gets
  sentiment, topic classification, a 1–5 severity score, impact score, and a
  one-sentence summary.
- **Daily cron (real ingest)** — fetches new issues from a configurable public
  GitHub repo via the GitHub Issues REST API, with pagination, rate-limit
  awareness, and exponential backoff. Runs locally via `npm run ingest` and in
  production via AWS Lambda + EventBridge (`rate(1 day)`). CSV upload is also
  supported through the UI.
- **Database** — Postgres with Prisma. `feedback_items` (raw) +
  `feedback_analyses` (LLM results) + `ingest_logs` (reliability) + `users` +
  `labels` + `saved_views` + `widgets` + `notification_logs` + RBAC tables.
- **UI**
  - **Dashboard** — KPI cards, sentiment trend (14-day line chart), sentiment
    distribution donut, topic distribution bar chart, severity distribution,
    recent high-severity list, and customizable widgets.
  - **Inbox** — sortable/filterable list with advanced search, pagination,
    bulk actions (status, assign, label, archive, snooze, delete), shift-click
    range selection, and predictive severity.
  - **Detail view** — raw content alongside structured AI analysis, impact
    breakdown, similar items, activity timeline, comments, and reply templates.
  - **Analytics** — root-cause analysis, period/source comparison, anomaly
    detection, and impact tracking.
  - **Management** — labels, reply templates, export templates, saved views,
    widgets, search history, audit logs, webhook delivery logs, and team/role
    administration.
- **RBAC — 10 role-based dashboards**
  - **10 roles**: Admin, Manager, Analyst, Support Agent, Viewer, Developer,
    QA Engineer, Product Owner, Marketing, Sales.
  - **Full RBAC schema**: `Role`, `Permission`, `RolePermission`, `UserRole`
    tables in Prisma. Each role carries a set of granular permissions
    (`page:dashboard`, `api:feedback:read`, `api:feedback:write`, etc.).
  - **Role-specific dashboards** — each role sees a curated dashboard with
    widgets relevant to their job (e.g., Developers see bug trackers and
    health metrics; Sales sees conversion funnels and revenue trends).
  - **Permission guards** — all API routes enforce `requirePermission`
    checks before any DB operation. The middleware blocks unauthorized page
    access at the edge. The navbar only shows links the user has permission
    to see.
  - **Admin role management** — admins can assign/remove roles for any user
    via `/admin/roles`.
- **Bonus**
  - **Slack webhooks** — outgoing notification when severity ≥ 4, plus a
    webhook delivery log and test button.
  - **In-app notifications** — global notification bell + `/notifications`
    page with mark-read, mark-all-read, and delete.
  - **Toast notifications** — consistent success/error/warning feedback across
    the app.
  - **Triage** — assign status `New` / `Acknowledged` / `Actioned` from the
    detail view or bulk action bar, plus snooze/archive with optional reasons.
  - **Daily digest** — summarises triage status, high-severity items, and
    recent feedback. Runs locally via `npm run digest` and in production via
    AWS Lambda + EventBridge (`rate(1 day)`).
  - **Idempotency & reliability** — `external_id` unique constraint prevents
    duplicates; per-item failure isolation; `IngestLog` records every run.

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Frontend/API | Next.js 14 (App Router) + Tailwind + TypeScript   |
| Auth         | NextAuth.js (Credentials, JWT)                    |
| Database     | PostgreSQL + Prisma (local docker, AWS RDS prod)  |
| LLM          | OpenAI `gpt-4o-mini` (JSON mode)                  |
| Data source  | GitHub Issues API (`@octokit/rest`) + CSV upload  |
| Auth / RBAC  | NextAuth.js + JWT-enriched roles/permissions      |
| Charts       | Recharts                                          |
| Cron (prod)  | AWS Lambda + EventBridge                          |
| IaC          | AWS SAM                                           |
| Hosting      | AWS Amplify (custom domain)                       |

## Architecture

```
[Frontend (Next.js + Tailwind + Framer Motion)]
   ↓ Auth (NextAuth / JWT)
[API Layer (Next.js Route Handlers)]
   ├── Auth Controller        → Users
   ├── Feedback Controller    → FeedbackItem + FeedbackAnalysis
   ├── Dashboard Controller   → Aggregated metrics + widgets
   ├── Analytics Controller   → Root cause, comparison, anomalies, impact
   ├── Search Controller      → Full-text search + search history
   ├── Webhook Controller     → Slack + webhook delivery logs
   ├── Digest Controller      → Email digest
   ├── Notification Controller→ In-app notifications
   └── Admin Controller       → Audit logs, roles
   ↓
[Database: AWS RDS Postgres]
   ↑
[Cron A: AWS Lambda + EventBridge (daily) — Ingest]
   1) Fetch new feedback (GitHub Issues API or CSV)
   2) Deduplicate by external_id
   3) Call LLM (OpenAI) for structured analysis
   4) Store analysis + write IngestLog
   5) Slack notify if severity ≥ 4 (bonus)
   ↑
[Cron B: AWS Lambda + EventBridge (daily) — Digest]
   1) Aggregate feedback by status/sentiment/severity
   2) Render HTML email summary
   3) Send via SMTP to configured recipient
```

## Quick start (local)

### Prerequisites
- Node 20+
- Docker (for local Postgres)
- An OpenAI API key
- (Optional) a GitHub personal access token to avoid the 60 req/hr limit

### Steps

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env
#   fill in: OPENAI_API_KEY, NEXTAUTH_SECRET, GITHUB_TOKEN (recommended)

# 3. Start Postgres
npm run db:up

# 4. Apply migrations + generate Prisma client
npx prisma migrate dev
npx prisma generate

# 5. Seed a demo user (+ optional sample feedback)
npm run seed
npm run seed -- --with-samples   # also inserts 5 sample analyzed items

# 6. Run the dev server
npm run dev
```

Open http://localhost:3000 → you'll be redirected to `/login`. Sign in with:

- **Email:** `demo@feedbackflow.dev`
- **Password:** `password123`

### Running the ingest job locally

```bash
npm run ingest
```

This fetches recent issues from `GITHUB_REPO` (default `vercel/next.js`),
analyzes them with OpenAI, and stores the results. Re-running is idempotent —
items already present (by `external_id`) are skipped.

You can also trigger an ingest from the UI by `POST /api/ingest` (e.g. with
`curl` + a session cookie) for demos.

### Seed scripts

```bash
# Create the first admin user (configurable via env vars)
npm run seed:admin
#   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=Secure123 npm run seed:admin

# Backfill Viewer role for existing users who have no roles
npm run backfill:viewer
#   --dry-run   preview without writing
```

### Running the digest job locally (Cron Pattern B)

```bash
npm run digest
```

This aggregates all feedback by status, sentiment, and severity, renders an
HTML email summary, and sends it to `DIGEST_TO` via the SMTP server at
`DIGEST_SMTP_URL`. The email includes high-severity items needing attention
and recent new feedback from the last 24 hours. Disabled if `DIGEST_SMTP_URL`
or `DIGEST_FROM` is unset.

You can also trigger a digest from the UI by `POST /api/digest` (e.g. with
`curl` + a session cookie) for demos.

## Data model

```
User              id, email (unique), hashedPassword, name, createdAt
FeedbackItem      id, source, externalId (unique), title, rawContent,
                  authorLogin, url, originalTimestamp, createdAt
FeedbackAnalysis  id, feedbackItemId (unique FK), sentiment, topics (JSON),
                  severityScore (1-5), summary, status (NEW|ACKNOWLEDGED|ACTIONED),
                  createdAt, updatedAt
FeedbackLink      id, fromItemId, toItemId, relationType (duplicate|related),
                  createdAt
FeedbackVote      id, feedbackItemId, userId, createdAt
FeedbackComment   id, feedbackItemId, userId, body, createdAt
IngestLog         id, runId, source, status (SUCCESS|PARTIAL|FAILURE),
                  itemsFetched, itemsNew, itemsSkipped, error, createdAt
Label             id, name (unique), color, createdAt
FeedbackItemLabel feedbackItemId, labelId (composite PK)
SavedView         id, userId, name, filters (JSON), sort, createdAt
Widget            id, userId, type, title, config (JSON), order, createdAt
SearchHistory     id, userId, query, createdAt
NotificationLog   id, userId, type, title, body, status (unread|read),
                  feedbackItemId, link, createdAt
Role              id, name (unique), description
Permission        id, name (unique), description
RolePermission    roleId, permissionId  (composite PK)
UserRole          userId, roleId        (composite PK)
ApiKey            id, userId, name, prefix, hashedKey, scopes, lastUsedAt,
                  createdAt
Webhook           id, userId, name, url, events, secret, active, createdAt
WebhookDelivery   id, webhookId, event, status, requestBody, responseBody,
                  responseStatus, error, createdAt
AuditEvent        id, actorId, action, resource, resourceId, metadata (JSON),
                  createdAt
```

Indexes: `feedback_items(source)`, `feedback_items(original_timestamp)`,
`feedback_analyses(sentiment)`, `feedback_analyses(severity_score)`,
`feedback_analyses(status)`, `ingest_logs(source)`, `ingest_logs(created_at)`,
`notification_logs(userId, status)`, `saved_views(userId)`, `widgets(userId)`.

## LLM output format

The model is forced to return strict JSON:

```json
{
  "sentiment": "negative",
  "topics": ["Bug Report", "Performance"],
  "severity_score": 4,
  "summary": "API rate limits are breaking batch imports; user requests a higher tier."
}
```

Validated with zod; retries on parse/API failure (exponential backoff). A single
bad item never aborts a run — failures are recorded and the batch continues.

## Project structure

```
.
├── amplify.yml                  # Amplify build settings
├── docker-compose.yml           # Local Postgres
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── (app)/               # Authenticated routes (dashboard, inbox, analytics, management)
│   │   ├── api/                 # Route handlers
│   │   ├── login/ signup/
│   │   ├── layout.tsx globals.css
│   ├── components/              # Navbar, PageShell, Filters, Badges, charts, managers, toast
│   ├── lib/                     # prisma, auth, github, llm, ingest, slack, digest, analytics, utils, types
│   ├── middleware.ts            # Route protection
│   └── types/next-auth.d.ts
├── scripts/
│   ├── ingest.ts                # Local cron runner (Cron A)
│   ├── digest.ts                # Local digest runner (Cron B)
│   ├── seed.ts
│   ├── seed-admin.ts            # Create the first admin user
│   ├── backfill-viewer-roles.ts # Assign Viewer to role-less users
│   ├── build-lambda.ts          # esbuild bundler for the ingest Lambda
│   └── build-digest-lambda.ts   # esbuild bundler for the digest Lambda
└── aws/
    ├── template.yaml            # SAM: RDS + 2 Lambdas + 2 EventBridge schedules + SecretsManager
    ├── lambda/handler.ts        # Ingest Lambda entrypoint
    ├── lambda/digest-handler.ts # Digest Lambda entrypoint
    └── README.md                # Full AWS deployment guide
```

## Deployment (AWS)

See **[aws/README.md](aws/README.md)** for the complete guide. Summary:

1. `cd aws && sam build && sam deploy --guided` — provisions RDS Postgres,
   the ingest Lambda, the daily EventBridge schedule, Secrets Manager, and a
   CloudWatch alarm.
2. Run `prisma migrate deploy` against the RDS endpoint.
3. Connect the GitHub repo in AWS Amplify; it auto-uses `amplify.yml`. Add the
   environment variables (including `DATABASE_URL` from RDS) and attach a
   custom domain (e.g. `feedbackflow.dev`).

A **demo video script** is available at [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)
covering all required evidence: Amplify dashboard + domain, new data after
ingestion, cron execution (EventBridge → Lambda → DB), and cloud services used.

## Security

- All secrets (DB connection, OpenAI key, GitHub token, Slack webhook,
  NextAuth secret) are loaded from environment variables — never hardcoded.
- `.env` is gitignored; `.env.example` contains only placeholders.
- Passwords are hashed with bcrypt (cost 12).
- Protected routes are enforced both by Next.js middleware (UI) and by
  `getServerSession` + `requirePermission` checks on every API route.
- RBAC permissions are embedded in the JWT token, so role checks happen
  at the edge (middleware) without DB lookups.
- API keys bypass RBAC and use OAuth-style scopes instead.
- In production, DB credentials live in AWS Secrets Manager; the Lambda
  resolves them at runtime.

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
npm run test        # vitest — unit tests for LLM + analytics + modules
npm run db:up && npx prisma migrate dev
npm run seed -- --with-samples
npm run seed:admin  # create the first admin user
npm run backfill:viewer  # assign Viewer to existing users
npm run ingest      # idempotent: re-run, itemsNew should be 0
npm run digest      # sends email if DIGEST_SMTP_URL is set
npm run dev         # manual UI walkthrough
```

### Tests

Unit tests cover the most critical code paths:

- **LLM module** (`src/lib/__tests__/llm.test.ts`) — Zod schema validation
  (valid/invalid sentiment, severity range, topic array constraints, summary
  length), JSON parsing, batch failure isolation.
- **Analytics modules** (`src/lib/__tests__/comparison.test.ts`,
  `anomaly.test.ts`, `impact.test.ts`, `root-cause.test.ts`) — aggregation,
  delta calculation, rolling stats, spike detection, and score breakdown.
- **Digest module** (`src/lib/__tests__/digest.test.ts`) — HTML rendering
  (status/sentiment tables, high-severity section, recent feedback section,
  empty states, links).
- **Bulk actions** (`src/lib/__tests__/bulk.test.ts`) — status, assignment,
  labeling, archive, snooze, and delete operations.

Run with `npm test` (one-shot) or `npm run test:watch` (watch mode).

## Acceptance criteria mapping

| Criterion                  | Where                                                    |
| -------------------------- | -------------------------------------------------------- |
| Auth + protected routes    | `src/middleware.ts`, `src/lib/auth.ts`, `(app)/layout.tsx` |
| Cron ingests real data     | `src/lib/github.ts`, `src/lib/ingest.ts`, `aws/lambda/handler.ts` |
| LLM analysis per item        | `src/lib/llm.ts`, `FeedbackAnalysis` rows                |
| Reliability + logging      | retry/backoff, `IngestLog`, idempotency via `externalId` |
| Inbox filter/sort + bulk   | `src/app/(app)/inbox/page.tsx`, `src/components/Filters.tsx`, `BulkActionBar.tsx` |
| Analytics                  | `src/app/(app)/{root-cause,comparison,anomalies,impact}/` |
| Management tools           | `src/app/(app)/{labels,reply-templates,export/templates,saved-views,widgets}/` |
| Secrets from env vars      | `.env.example`, no hardcoded secrets                     |
| Triage + digest (bonus)    | `src/components/StatusSelect.tsx`, `src/lib/digest.ts`, `aws/lambda/digest-handler.ts` |

## License

MIT
