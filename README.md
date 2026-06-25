# FeedbackFlow AI

> Automated micro-SaaS to ingest, analyze, and triage real-world B2B/B2C
> public reviews using LLMs.

FeedbackFlow AI pulls in real customer feedback from a public source
(GitHub Issues API), runs a multi-task LLM analysis on each item
(sentiment, topics, severity, summary), stores the raw + structured results in
Postgres, and presents a dashboard + inbox + detail UI for Product Managers
and Customer Success teams to triage it.

## Features

- **Auth** — secure signup/login (NextAuth, JWT sessions, bcrypt). All routes
  protected by middleware; logged-out users are redirected to `/login`.
- **LLM integration** — OpenAI `gpt-4o-mini` with structured JSON output
  (`response_format: json_object`) + zod validation + retry. Each item gets
  sentiment, topic classification, a 1–5 severity score, and a one-sentence
  summary.
- **Daily cron (real ingest)** — fetches new issues from a configurable public
  GitHub repo via the GitHub Issues REST API, with pagination, rate-limit
  awareness, and exponential backoff. Runs locally via `npm run ingest` and in
  production via AWS Lambda + EventBridge (`rate(1 day)`).
- **Database** — Postgres with Prisma. `feedback_items` (raw) +
  `feedback_analyses` (LLM results) + `ingest_logs` (reliability) + `users`.
- **UI**
  - **Dashboard** — KPI cards, sentiment trend (14-day line chart), sentiment
    distribution donut, topic distribution bar chart, severity distribution,
    and a recent high-severity list.
  - **Inbox** — sortable/filterable list (by sentiment, topic, severity,
    status) with pagination.
  - **Detail view** — raw content alongside the structured AI analysis.
- **Bonus**
  - **Slack webhooks** — outgoing notification when severity ≥ 4.
  - **Triage (Cron Pattern B)** — assign status `New` / `Acknowledged` /
    `Actioned` from the detail view, plus a daily email digest summarising
    triage status, high-severity items, and recent feedback. Runs locally via
    `npm run digest` and in production via a second AWS Lambda + EventBridge
    (`rate(1 day)`).
  - **Idempotency & reliability** — `external_id` unique constraint prevents
    duplicates; per-item failure isolation; `IngestLog` records every run.

## Tech stack

| Layer        | Choice                                            |
| ------------ | ------------------------------------------------- |
| Frontend/API | Next.js 14 (App Router) + Tailwind + TypeScript   |
| Auth         | NextAuth.js (Credentials, JWT)                    |
| Database     | PostgreSQL + Prisma (local docker, AWS RDS prod)  |
| LLM          | OpenAI `gpt-4o-mini` (JSON mode)                  |
| Data source  | GitHub Issues API (`@octokit/rest`)               |
| Charts       | Recharts                                          |
| Cron (prod)  | AWS Lambda + EventBridge                          |
| IaC          | AWS SAM                                           |
| Hosting      | AWS Amplify (custom domain)                       |

## Architecture

```
[Frontend (Next.js + Tailwind)]
   ↓ Auth (NextAuth / JWT)
[API Layer (Next.js Route Handlers)]
   ├── Auth Controller        → Users
   ├── Feedback Controller    → FeedbackItem + FeedbackAnalysis
   ├── Dashboard Controller   → Aggregated metrics
   ├── Webhook Controller     → Slack (bonus)
   └── Digest Controller      → Email digest (bonus)
   ↓
[Database: AWS RDS Postgres]
   ↑
[Cron A: AWS Lambda + EventBridge (daily) — Ingest]
   1) Fetch new feedback (GitHub Issues API)
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
IngestLog         id, runId, source, status (SUCCESS|PARTIAL|FAILURE),
                  itemsFetched, itemsNew, itemsSkipped, error, createdAt
```

Indexes: `feedback_items(source)`, `feedback_items(original_timestamp)`,
`feedback_analyses(sentiment)`, `feedback_analyses(severity_score)`,
`feedback_analyses(status)`, `ingest_logs(source)`, `ingest_logs(created_at)`.

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
│   │   ├── (app)/               # Authenticated routes (dashboard, inbox)
│   │   ├── api/                 # Route handlers
│   │   ├── login/ signup/
│   │   ├── layout.tsx globals.css
│   ├── components/              # Navbar, Filters, Badges, charts, StatusSelect
│   ├── lib/                     # prisma, auth, github, llm, ingest, slack, digest, utils, types
│   ├── middleware.ts            # Route protection
│   └── types/next-auth.d.ts
├── scripts/
│   ├── ingest.ts                # Local cron runner (Cron A)
│   ├── digest.ts                # Local digest runner (Cron B)
│   ├── seed.ts
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
  `getServerSession` checks on every API route.
- In production, DB credentials live in AWS Secrets Manager; the Lambda
  resolves them at runtime.

## Verification

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
npm run test        # vitest — unit tests for LLM + digest modules
npm run db:up && npx prisma migrate dev
npm run seed -- --with-samples
npm run ingest      # idempotent: re-run, itemsNew should be 0
npm run digest      # sends email if DIGEST_SMTP_URL is set
npm run dev         # manual UI walkthrough
```

### Tests

Unit tests cover the most critical code paths:

- **LLM module** (`src/lib/__tests__/llm.test.ts`) — Zod schema validation
  (valid/invalid sentiment, severity range, topic array constraints, summary
  length), JSON parsing, batch failure isolation.
- **Digest module** (`src/lib/__tests__/digest.test.ts`) — HTML rendering
  (status/sentiment tables, high-severity section, recent feedback section,
  empty states, links).

Run with `npm test` (one-shot) or `npm run test:watch` (watch mode).

## Acceptance criteria mapping

| Criterion                  | Where                                                    |
| -------------------------- | -------------------------------------------------------- |
| Auth + protected routes    | `src/middleware.ts`, `src/lib/auth.ts`, `(app)/layout.tsx` |
| Cron ingests real data     | `src/lib/github.ts`, `src/lib/ingest.ts`, `aws/lambda/handler.ts` |
| LLM analysis per item      | `src/lib/llm.ts`, `FeedbackAnalysis` rows                |
| Reliability + logging      | retry/backoff, `IngestLog`, idempotency via `externalId` |
| Inbox filter/sort          | `src/app/(app)/inbox/page.tsx`, `src/components/Filters.tsx` |
| Secrets from env vars      | `.env.example`, no hardcoded secrets                     |
| Triage + digest (bonus)    | `src/components/StatusSelect.tsx`, `src/lib/digest.ts`, `aws/lambda/digest-handler.ts` |

## License

MIT
