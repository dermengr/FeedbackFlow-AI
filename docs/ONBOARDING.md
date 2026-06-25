# FeedbackFlow AI — Onboarding Guide

Welcome to **FeedbackFlow AI**. This guide is the fastest path from zero to
productive on this codebase. Read it top-to-bottom on day one, then keep it as a
reference map.

---

## 1. Project Overview

| | |
|---|---|
| **Name** | FeedbackFlow AI |
| **Tagline** | Automated micro-SaaS to ingest, analyze, and triage real-world B2B/B2C public reviews using LLMs. |
| **Languages** | TypeScript, JavaScript, Prisma, SQL, YAML, Markdown, CSS, JSON, TOML, Dockerfile |
| **Frameworks** | Next.js 14 (App Router), NextAuth.js, Prisma, TailwindCSS, Recharts, OpenAI, AWS SAM, AWS Lambda |
| **Node** | `>=18.17.0` |

### What it does

FeedbackFlow AI pulls in **real customer feedback** from the GitHub Issues API,
runs **multi-task LLM analysis** (sentiment, topics, severity, summary) on each
item, stores both the raw content and structured results in **Postgres**, and
presents a **dashboard + inbox + detail UI** for Product Managers and Customer
Success teams to triage what matters.

The end-to-end flow is:

```
GitHub Issues API ──► Ingest Pipeline ──► LLM Analysis ──► Postgres ──► Dashboard / Inbox UI
                                          │                       │
                                          └─ Zod validation       └─ Slack webhook (severity >= 4)
```

---

## 2. Architecture Layers

The codebase is organized into **9 layers** comprising **59 file-level nodes**.
Each layer has a single responsibility and a clear dependency direction
(UI → Components → API → Service → Data), with cross-cutting support from
Utility, Infra, Config, and Docs layers.

### 2.1 UI Layer (9 nodes)

Next.js App Router pages, the root and authenticated layouts, and global styles
that form the presentation and routing shell.

**Key files:**
- `src/app/layout.tsx` — root layout, wraps tree in `SessionProvider`
- `src/app/page.tsx` — root landing/redirect
- `src/app/(app)/layout.tsx` — authenticated layout shell with `Navbar`
- `src/app/(app)/dashboard/page.tsx` — server-rendered dashboard with KPIs
- `src/app/(app)/inbox/page.tsx` — filterable/sortable inbox listing
- `src/app/(app)/inbox/[id]/page.tsx` — feedback detail view (raw + AI analysis)
- `src/app/login/page.tsx`, `src/app/signup/page.tsx` — auth pages
- `src/app/globals.css` — Tailwind directives + global styles

### 2.2 Component Layer (9 nodes)

Reusable React UI components: navigation, providers, badges, filters, status
controls, and Recharts-based dashboard visualizations.

**Key files:**
- `src/components/Navbar.tsx` — top navigation with session state
- `src/components/Providers.tsx` — client-side context providers
- `src/components/Badges.tsx` — sentiment/topic/severity badges
- `src/components/Filters.tsx` — inbox filter controls
- `src/components/StatusSelect.tsx` — inline status change control
- `src/components/charts/SentimentDonutChart.tsx`
- `src/components/charts/SentimentTrendChart.tsx`
- `src/components/charts/SeverityChart.tsx`
- `src/components/charts/TopicDistributionChart.tsx`

### 2.3 API Layer (7 nodes)

Next.js App Router API route handlers exposing REST endpoints for auth,
dashboard analytics, feedback CRUD, ingest triggering, and Slack webhooks.

**Key files:**
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth handlers
- `src/app/api/auth/signup/route.ts` — email/password registration
- `src/app/api/dashboard/route.ts` — dashboard analytics aggregation
- `src/app/api/feedback/route.ts` — feedback list (filter/sort/paginate)
- `src/app/api/feedback/[id]/route.ts` — single feedback item + status update
- `src/app/api/ingest/route.ts` — manual ingest trigger
- `src/app/api/webhook/slack/route.ts` — incoming Slack webhook receiver

### 2.4 Service Layer (7 nodes)

Core business logic in `src/lib`: ingest pipeline orchestrator, LLM analysis,
GitHub ingestion adapter, Slack notifications, NextAuth config, Prisma client
singleton, and middleware.

**Key files:**
- `src/lib/auth.ts` — NextAuth config (credentials provider, JWT sessions)
- `src/lib/prisma.ts` — Prisma client singleton (avoids hot-reload exhaustion)
- `src/lib/ingest.ts` — `runIngest` orchestrator: fetch → dedupe → analyze → store → notify
- `src/lib/github.ts` — Octokit client, paginated issues, rate-limit backoff
- `src/lib/llm.ts` — prompt building, OpenAI `gpt-4o-mini` JSON mode, Zod validation, retries
- `src/lib/slack.ts` — feature-flagged outgoing webhook for severity >= 4
- `src/middleware.ts` — validates NextAuth session token on protected paths

### 2.5 Shared Utility & Types Layer (3 nodes)

Foundational shared helpers with high fan-in: className/date/format/backoff
utilities, sentiment/topic/status constants, and NextAuth type augmentations.

**Key files:**
- `src/lib/utils.ts` — `cn()` class merger, date/format helpers, `backoff()`
- `src/lib/types.ts` — sentiment/topic/status constants and shared types
- `src/types/next-auth.d.ts` — NextAuth session type augmentation

### 2.6 Data Layer (7 nodes)

Prisma schema, initial PostgreSQL migration SQL, table definitions, and the
migration lock.

**Key files:**
- `prisma/schema.prisma` — models: `User`, `FeedbackItem`, `FeedbackAnalysis`, `IngestLog`
- `prisma/migrations/<init>/migration.sql` — initial DDL
- Tables: `users`, `feedback_items`, `feedback_analyses`, `ingest_logs`
- `prisma/migrations/migration_lock.toml` — migration provider lock

### 2.7 Infrastructure & Operations Layer (7 nodes)

AWS SAM/CloudFormation template, Lambda ingest handler, Docker Compose, Amplify
build spec, and build/seed/ingest CLI scripts.

**Key files:**
- `aws/template.yaml` — SAM stack: VPC, RDS Postgres, Lambda, EventBridge cron
- `aws/lambda/handler.ts` — Lambda entry point invoking `runIngest`
- `docker-compose.yml` — local Postgres for dev
- `amplify.yml` — AWS Amplify hosting build spec
- `scripts/build-lambda.ts` — esbuild-based Lambda bundler
- `scripts/ingest.ts` — CLI ingest runner
- `scripts/seed.ts` — database seed script

### 2.8 Configuration Layer (8 nodes)

Project and tooling configuration.

**Key files:**
- `package.json` — dependencies and npm scripts
- `tsconfig.json` — TypeScript compiler config
- `.env.example` — environment variable template
- `next.config.mjs` — Next.js config
- `postcss.config.js`, `tailwind.config.ts` — styling pipeline
- `.eslintrc.json` — lint rules
- `tsconfig.tsbuildinfo` — incremental build cache

### 2.9 Documentation Layer (2 nodes)

- `README.md` — comprehensive project documentation
- `aws/README.md` — AWS deployment guide

---

## 3. Key Concepts

These are the design decisions and patterns that shape the codebase.
Understanding them up front will make everything else click.

### Next.js App Router
The app uses the **App Router** (`src/app/`) with React Server Components by
default. Server components fetch data directly from Prisma; client components
(those using hooks or Recharts) are marked with `"use client"`. Route groups
like `(app)` group authenticated routes without affecting the URL.

### NextAuth JWT Sessions
Authentication is handled by **NextAuth.js** with a credentials provider
(email/password, bcrypt-hashed). Sessions are **JWT-based** (not database
sessions), so the session token is validated in `src/middleware.ts` on every
request to protected paths — no DB hit per request. Session types are augmented
in `src/types/next-auth.d.ts`.

### Prisma ORM
**Prisma** is the data access layer. The schema (`prisma/schema.prisma`) is the
single source of truth; migrations are managed with `prisma migrate`. A
singleton client (`src/lib/prisma.ts`) prevents connection exhaustion during
Next.js hot-reload. The client is generated to `node_modules/.prisma/client` so
it can be bundled into the Lambda artifact.

### LLM Structured Output with Zod Validation
`src/lib/llm.ts` calls OpenAI `gpt-4o-mini` in **JSON mode** and validates the
response against a **Zod schema**. If validation fails, it retries with a
bounded backoff. This guarantees the analysis columns (`sentiment`, `topics`,
`severityScore`, `summary`) are always well-typed before being persisted.

### Idempotency via `external_id`
Every ingested `FeedbackItem` carries an `externalId` that is **unique per
source** (e.g. `vercel/next.js#12345`). The ingest pipeline upserts on this key,
so re-running a cron job or re-triggering ingest never creates duplicates — it
just skips already-seen items and logs them in `IngestLog`.

### Exponential Backoff for Rate Limits
`src/lib/github.ts` paginates the GitHub Issues API and detects rate-limit
responses, then retries with **exponential backoff** (helper in
`src/lib/utils.ts`). A `GITHUB_TOKEN` is strongly recommended to lift the
unauthenticated 60 req/hr ceiling.

### AWS Lambda + EventBridge Cron
In production, ingest runs on a schedule. The SAM template (`aws/template.yaml`)
deploys a **Lambda** function (bundled by `scripts/build-lambda.ts`) triggered
by an **EventBridge cron** rule, writing to **RDS Postgres** inside a VPC. The
same `runIngest` orchestrator powers both the local CLI and the Lambda path.

### Feature-Flagged Slack Notifications
`src/lib/slack.ts` is **feature-flagged** via `SLACK_WEBHOOK_URL`: if the env var
is empty, notifications are silently skipped. When set, a webhook fires for any
item with `severityScore >= 4`.

---

## 4. Guided Tour

A 12-step walkthrough from "what is this?" to "how is it deployed?" Follow this
order on first read.

| # | Step | What you learn |
|---|------|----------------|
| 1 | **Project Overview** | Start with `README.md` to grasp what FeedbackFlow AI is and why it exists. |
| 2 | **Application Entry Point** | Next.js App Router boots from the root layout (`src/app/layout.tsx`), which wraps the tree in `SessionProvider`. |
| 3 | **Authentication & Route Protection** | `src/middleware.ts` validates the NextAuth session token on every request to protected paths. |
| 4 | **Data Model & Schema** | `prisma/schema.prisma` defines the `User`, `FeedbackItem`, `FeedbackAnalysis`, and `IngestLog` models. |
| 5 | **Shared Foundation** | Three high-fan-in files: `src/lib/prisma.ts` (client singleton), `src/lib/types.ts` (constants), `src/lib/utils.ts` (helpers). |
| 6 | **Ingest Pipeline Orchestrator** | `src/lib/ingest.ts` — `runIngest` fetches, deduplicates, analyzes, stores, and notifies. |
| 7 | **GitHub Issues Ingestion** | `src/lib/github.ts` builds an Octokit client, paginates issues, and handles rate limits with exponential backoff. |
| 8 | **LLM Analysis** | `src/lib/llm.ts` builds prompts, calls OpenAI `gpt-4o-mini` in JSON mode, validates with Zod, and retries on failure. |
| 9 | **Slack Notifications** | `src/lib/slack.ts` is feature-flagged and sends a webhook when `severityScore >= 4`. |
| 10 | **API Routes** | `src/app/api/` routes: dashboard analytics, feedback CRUD, ingest trigger, auth, Slack webhook. |
| 11 | **Dashboard & Inbox UI** | Dashboard (KPI cards, charts), Inbox (filterable/sortable list), Detail view (raw + AI analysis). |
| 12 | **Infrastructure & Deployment** | AWS SAM template (VPC, RDS Postgres, Lambda, EventBridge), Amplify hosting, Docker Compose for local dev. |

---

## 5. File Map

What each key file does, organized by layer.

### UI Layer
| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout; imports `globals.css`, wraps tree in `SessionProvider`. |
| `src/app/page.tsx` | Root route; redirects to dashboard or login based on session. |
| `src/app/(app)/layout.tsx` | Authenticated layout shell rendering `Navbar` + children. |
| `src/app/(app)/dashboard/page.tsx` | Server-rendered dashboard: KPI cards + chart data fetched from Prisma. |
| `src/app/(app)/inbox/page.tsx` | Inbox listing with filtering, sorting, and pagination. |
| `src/app/(app)/inbox/[id]/page.tsx` | Detail view showing raw feedback + AI analysis + status control. |
| `src/app/login/page.tsx` | Login form posting to NextAuth credentials provider. |
| `src/app/signup/page.tsx` | Signup form posting to the signup API route. |
| `src/app/globals.css` | Tailwind directives and global styles. |

### Component Layer
| File | Purpose |
|------|---------|
| `src/components/Navbar.tsx` | Top navigation showing links + session state. |
| `src/components/Providers.tsx` | Client-side context providers (`SessionProvider`). |
| `src/components/Badges.tsx` | Sentiment / topic / severity badge primitives. |
| `src/components/Filters.tsx` | Inbox filter controls (sentiment, topic, status, severity). |
| `src/components/StatusSelect.tsx` | Inline status change control (`NEW`/`ACKNOWLEDGED`/`ACTIONED`). |
| `src/components/charts/SentimentDonutChart.tsx` | Recharts donut of sentiment distribution. |
| `src/components/charts/SentimentTrendChart.tsx` | Recharts line/area of sentiment over time. |
| `src/components/charts/SeverityChart.tsx` | Recharts bar of severity score distribution. |
| `src/components/charts/TopicDistributionChart.tsx` | Recharts chart of topic frequency. |

### API Layer
| File | Purpose |
|------|---------|
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth route handlers (sign in, sign out, session). |
| `src/app/api/auth/signup/route.ts` | Email/password registration; hashes password with bcrypt. |
| `src/app/api/dashboard/route.ts` | Aggregates analytics (counts, distributions, trends) for the dashboard. |
| `src/app/api/feedback/route.ts` | Lists feedback with filtering, sorting, and pagination. |
| `src/app/api/feedback/[id]/route.ts` | Returns a single feedback item + analysis; accepts status updates. |
| `src/app/api/ingest/route.ts` | Manually triggers `runIngest` (protected). |
| `src/app/api/webhook/slack/route.ts` | Receives incoming Slack webhooks. |

### Service Layer
| File | Purpose |
|------|---------|
| `src/lib/auth.ts` | NextAuth config: credentials provider, JWT session strategy, callbacks. |
| `src/lib/prisma.ts` | Prisma client singleton to survive hot-reload. |
| `src/lib/ingest.ts` | `runIngest` orchestrator: fetch → dedupe → analyze → store → notify, writes `IngestLog`. |
| `src/lib/github.ts` | Builds Octokit client, paginates issues, handles rate limits with exponential backoff. |
| `src/lib/llm.ts` | Builds prompts, calls OpenAI `gpt-4o-mini` in JSON mode, validates with Zod, retries on failure. |
| `src/lib/slack.ts` | Feature-flagged outgoing webhook for severity >= 4. |
| `src/middleware.ts` | Validates NextAuth session token; protects `(app)` routes. |

### Shared Utility & Types Layer
| File | Purpose |
|------|---------|
| `src/lib/utils.ts` | `cn()` class merger, date/format helpers, `backoff()` for retries. |
| `src/lib/types.ts` | Sentiment / topic / status constants and shared TS types. |
| `src/types/next-auth.d.ts` | Augments NextAuth session/user types with app fields. |

### Data Layer
| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Defines `User`, `FeedbackItem`, `FeedbackAnalysis`, `IngestLog` + enums. |
| `prisma/migrations/<init>/migration.sql` | Initial DDL for `users`, `feedback_items`, `feedback_analyses`, `ingest_logs`. |
| `prisma/migrations/migration_lock.toml` | Locks the migration provider to PostgreSQL. |

### Infrastructure & Operations Layer
| File | Purpose |
|------|---------|
| `aws/template.yaml` | SAM/CloudFormation: VPC, RDS Postgres, Lambda, EventBridge cron, IAM. |
| `aws/lambda/handler.ts` | Lambda entry point that invokes `runIngest` with env-driven config. |
| `docker-compose.yml` | Local Postgres service for development. |
| `amplify.yml` | AWS Amplify hosting build spec for the Next.js frontend. |
| `scripts/build-lambda.ts` | esbuild-based bundler producing the Lambda artifact. |
| `scripts/ingest.ts` | CLI runner for `runIngest` (local/manual ingest). |
| `scripts/seed.ts` | Seeds the database with sample users + feedback for local dev. |

### Configuration Layer
| File | Purpose |
|------|---------|
| `package.json` | Dependencies, engines, and npm scripts. |
| `tsconfig.json` | TypeScript compiler options + path aliases. |
| `.env.example` | Template for all required environment variables. |
| `next.config.mjs` | Next.js runtime config. |
| `postcss.config.js` | PostCSS pipeline (Tailwind + autoprefixer). |
| `tailwind.config.ts` | Tailwind theme, content paths, plugins. |
| `.eslintrc.json` | ESLint config extending `next/core-web-vitals`. |
| `tsconfig.tsbuildinfo` | Incremental TypeScript build cache. |

### Documentation Layer
| File | Purpose |
|------|---------|
| `README.md` | Comprehensive project overview, setup, and usage docs. |
| `aws/README.md` | AWS deployment guide (SAM build/deploy, RDS, Amplify). |

---

## 6. Complexity Hotspots

These files carry the most logic and have the sharpest learning curves. Approach
them carefully and with tests/examples open alongside.

### Complex files (approach carefully)

| File | Why it's complex |
|------|------------------|
| `src/app/(app)/inbox/page.tsx` | Inbox listing with filtering, sorting, and pagination across query params + Prisma. |
| `src/lib/github.ts` | GitHub issues ingestion with pagination, rate-limit detection, and exponential backoff. |
| `src/app/api/dashboard/route.ts` | Dashboard analytics aggregation (counts, distributions, time-series) in a single query pass. |
| `src/app/api/feedback/route.ts` | Feedback list API with dynamic filtering/sorting/pagination. |
| `src/lib/ingest.ts` | Core ingest pipeline orchestrator tying fetch → dedupe → analyze → store → notify together. |
| `src/app/(app)/dashboard/page.tsx` | Server-rendered dashboard assembling KPIs + chart data. |
| `README.md` | Comprehensive project documentation — dense, worth a full read. |
| `aws/template.yaml` | AWS SAM/CloudFormation template (VPC, RDS, Lambda, EventBridge, IAM). |

### Moderate files (21 files)

These are approachable but non-trivial: the LLM module (`src/lib/llm.ts`),
auth config (`src/lib/auth.ts`), Slack helper (`src/lib/slack.ts`), the four
chart components, signup/login pages, the seed script (`scripts/seed.ts`), the
Prisma schema, and the initial migration SQL, among others. Read the relevant
layer section above before diving in.

---

## 7. Getting Started

### Prerequisites

- **Node.js** `>=18.17.0`
- **Docker** (for local Postgres)
- An **OpenAI API key** (`gpt-4o-mini`)
- A **GitHub personal access token** (recommended, to avoid the 60 req/hr limit)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in:
#   NEXTAUTH_SECRET     -> openssl rand -base64 32
#   OPENAI_API_KEY      -> your OpenAI key
#   GITHUB_REPO         -> e.g. vercel/next.js
#   GITHUB_TOKEN        -> your GitHub PAT (recommended)
#   SLACK_WEBHOOK_URL   -> optional
```

### 3. Start Postgres and apply migrations

```bash
npm run db:up          # docker compose up -d db
npm run prisma:migrate # prisma migrate dev (creates tables)
```

### 4. Seed sample data

```bash
npm run seed           # tsx scripts/seed.ts
```

### 5. Run the dev server

```bash
npm run dev            # http://localhost:3000
```

### 6. (Optional) Trigger an ingest manually

```bash
npm run ingest         # tsx scripts/ingest.ts  (CLI)
# or hit the protected API endpoint once logged in:
#   POST http://localhost:3000/api/ingest
```

### Useful npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run prisma:studio` | Open Prisma Studio DB browser |
| `npm run db:up` / `db:down` | Start/stop local Postgres |
| `npm run seed` | Seed sample data |
| `npm run ingest` | Run ingest from CLI |
| `npm run ingest:lambda` | Bundle the Lambda handler |
| `npm run sam:validate` / `sam:build` / `sam:deploy` | AWS SAM workflow |

### Deployment

- **Frontend:** AWS Amplify (see `amplify.yml`).
- **Ingest cron:** AWS Lambda + EventBridge (see `aws/template.yaml` and
  `aws/README.md`).
- **Database:** RDS Postgres (provisioned by the SAM template).

```bash
cd aws
sam validate
sam build
sam deploy --guided
```

---

## Next Steps

1. Read `README.md` for the full product narrative.
2. Walk the **Guided Tour** (Section 4) in order, opening each file as you go.
3. Run the **Getting Started** flow end-to-end so you have a working local app
   with seeded data.
4. Pick a **Complexity Hotspot** (Section 6) and trace one full request through
   it (e.g. `/inbox` → `inbox/page.tsx` → `api/feedback/route.ts` → Prisma).
5. When ready to deploy, follow `aws/README.md`.

Happy triaging! 🛠️
