# Ingest Pipeline — `src/lib/ingest.ts`

> The heart of FeedbackFlow AI: a single orchestrator that turns raw GitHub
> Issues into structured, triageable, alert-ready customer feedback.

This document is a deep-dive on the ingest pipeline orchestrator
(`src/lib/ingest.ts`) and its surrounding neighborhood. It is derived from the
project's knowledge graph (node `file:src/lib/ingest.ts`, complexity `complex`,
tags `service / ingest / data-pipeline / orchestration`) and the actual source.

---

## 1. Role in the architecture

`ingest.ts` lives in the **Service Layer** (`layer:service` in the knowledge
graph), alongside `llm.ts`, `github.ts`, `slack.ts`, `auth.ts`, `prisma.ts`,
and `middleware.ts`. The Service Layer sits between the Next.js API/UI layers
and the Data Layer (Prisma + Postgres) and holds the core business logic.

Within that layer, `ingest.ts` is the **orchestrator** — the one module that
ties every other service together. The knowledge-graph tour calls it out
explicitly (step 6, "Ingest Pipeline Orchestrator"):

> "The ingest module is the heart of the product: its `runIngest` function
> fetches raw feedback from a source, deduplicates against existing records by
> source + external id, batches items through LLM analysis, persists raw +
> analysis rows in a Prisma transaction, logs the run to `ingest_logs`, and
> notifies Slack on high-severity findings."

It is the single function invoked by **three** different entry points, all of
which share identical behavior:

| Entry point | File | Edge in graph |
| --- | --- | --- |
| Local cron runner | `scripts/ingest.ts` | `imports → file:src/lib/ingest.ts` |
| Manual UI trigger | `src/app/api/ingest/route.ts` (`POST`) | `calls → function:...:runIngest` |
| Production cron | `aws/lambda/handler.ts` (`handler`) | `calls → function:...:runIngest` |

This fan-in is deliberate: the same pipeline runs from `npm`, an HTTP route, or
an AWS Lambda without a single line of code changing between environments.

---

## 2. Internal structure

The file is small (~195 lines) and contains exactly two functions plus two
exported interfaces:

### `IngestResult` (interface, lines 18–27)
The structured return value of every run. It is the contract every caller
(Lambda, API route, CLI) serializes and inspects:

```ts
{
  runId: string;            // randomUUID() per run
  source: string;           // e.g. "GitHubIssues"
  status: "SUCCESS" | "PARTIAL" | "FAILURE";
  itemsFetched: number;
  itemsNew: number;
  itemsSkipped: number;     // duplicates
  failures: Array<{ externalId: string; error: string }>;
  error?: string;
}
```

### `IngestOptions` (interface, lines 31–35)
Allows tests/manual triggers to inject a custom `fetcher` and `source`, so the
pipeline can be exercised without hitting GitHub or OpenAI.

### `runIngest(opts)` (lines 37–176) — the orchestrator
Complexity `complex`. This is the pipeline. Its six sub-steps are documented
inline and below in §4 (Data flow).

### `persistLog(result)` (lines 178–195) — private helper
Writes one row to the `IngestLog` table at the end of every run (and on early
exits). It is wrapped in its own `try/catch` because **logging must never fail
the run** — a failed log write is only `console.error`'d, never thrown.

---

## 3. External connections (the neighborhood)

The knowledge graph records five `imports` edges leaving `ingest.ts`, each to a
service it composes:

```
ingest.ts ──imports──► github.ts   (fetch)
ingest.ts ──imports──► llm.ts      (analyze)
ingest.ts ──imports──► slack.ts    (notify)
ingest.ts ──imports──► prisma.ts   (persist)
ingest.ts ──imports──► types.ts    (RawFeedbackItem shape)
```

And two `calls` edges from `runIngest`:

```
runIngest ──calls──► llm.ts:analyzeBatch
runIngest ──calls──► slack.ts:notifyHighSeverity
```

### `github.ts` — the real-world data source
The GitHub Issues ingestion adapter (complexity `complex`). `fetchGitHubIssues`
builds an Octokit client, paginates `issues.listForRepo` for open issues created
within `INGEST_LOOKBACK_HOURS` (default 24h), up to `INGEST_MAX_ITEMS` (default
50), from the repo in `GITHUB_REPO` (default `vercel/next.js`). It:

- **Parses rate-limit headers** (`parseRateLimit`) and proactively sleeps before
  the quota is exhausted (`waitForRateLimit`, capped at 60s so a cron never
  hangs forever).
- **Retries with exponential backoff** (`backoffDelay`/`sleep` from `utils.ts`),
  up to 4 attempts, skipping retry on hard 404/401.
- **Normalizes** each issue into the internal `RawFeedbackItem` shape, skipping
  pull requests, with `externalId = "${owner}/${repo}#${issue.number}"`.
- Exports the constant `GITHUB_SOURCE = "GitHubIssues"` used as the default
  `source` by `runIngest`.

### `llm.ts` — structured analysis
`analyzeBatch` (called by `runIngest`) iterates items and calls
`analyzeFeedback` per item, which prompts OpenAI `gpt-4o-mini` (JSON mode,
temperature 0) for a four-task analysis — **sentiment, topics (from the
`TOPIC_TAXONOMY`), severity_score (1–5), summary** — then validates the
response with a **Zod `AnalysisSchema`** and retries with backoff on failure.
`analyzeBatch` **isolates failures**: a single bad item is recorded in
`failures[]` and does not abort the rest of the batch.

### `slack.ts` — bonus alerting
`notifyHighSeverity` is called by `runIngest` only when
`analysis.severity_score >= HIGH_SEVERITY_THRESHOLD` (4). It is gated by
`isSlackEnabled()` (checks `SLACK_WEBHOOK_URL`) and posts a formatted message
to the incoming webhook. Critically, the call in `runIngest` is wrapped in its
own `try/catch` so a Slack outage can never fail an otherwise-successful ingest.

### `prisma.ts` — persistence singleton
The Prisma client singleton (reused across hot-reloads / Lambda invocations).
`runIngest` uses `prisma.feedbackItem.findMany` (dedupe read),
`prisma.$transaction` (atomic write of item + analysis), and
`prisma.ingestLog.create` (reliability log).

### `types.ts` — shared vocabulary
Defines `RawFeedbackItem` (the normalized shape produced by `github.ts` and
consumed by `ingest.ts`/`llm.ts`), `LlmAnalysisResult`, `SENTIMENTS`,
`TOPIC_TAXONOMY`, and `FEEDBACK_STATUSES`. Centralizing these keeps the UI and
pipeline vocabularies in sync.

---

## 4. Data flow

The pipeline is a linear six-step transform from a public API to a triageable
database row, with idempotency, failure isolation, and observability built in:

```
GitHub Issues API
      │  fetchGitHubIssues()  (paginate, rate-limit aware, backoff)
      ▼
RawFeedbackItem[]            source="GitHubIssues", externalId="owner/repo#N"
      │
      │  1. fetch        (try/catch → FAILURE + persistLog on error)
      │  2. dedupe       findMany externalId IN (...) → filter newItems
      │                  (unique constraint is the ultimate guard)
      │  3. analyze      analyzeBatch(newItems) → { results, failures }
      │  4. persist      per-item $transaction:
      │                      feedbackItem.create  (raw)
      │                      feedbackAnalysis.create (sentiment/topics/severity/summary, status="NEW")
      │  5. notify       if severity_score >= 4 → notifyHighSeverity (best-effort)
      │  6. log          persistLog → ingest_logs row
      ▼
IngestResult { runId, status, counts, failures }
```

Step-by-step from `runIngest`:

1. **Fetch** (lines 55–73). Calls the fetcher (default `fetchGitHubIssues`).
   On throw → `status = "FAILURE"`, record `error`, `persistLog`, return early.
   Empty result → log and return `SUCCESS` with zero counts.

2. **Deduplicate** (lines 75–94). Reads existing `externalId`s from
   `feedback_items` and filters `rawItems` down to `newItems`. This is an
   optimization to avoid spending LLM calls on items already stored; the
   **real guard** is the `externalId` unique constraint in Postgres.

3. **LLM analysis** (lines 96–101). `analyzeBatch(newItems)` returns
   `{ results, failures }`. Per-item failures are mapped into
   `result.failures` immediately.

4. **Persist** (lines 103–157). For each `{ item, analysis }` pair, a
   `prisma.$transaction` atomically creates the `feedbackItem` (raw) **and**
   its `feedbackAnalysis` (structured). Each pair is its own transaction, so
   one failure rolls back only that pair — a partial run can be safely
   re-run. A caught DB error (e.g. unique-constraint race) is appended to
   `result.failures` and the loop continues.

5. **Slack notify** (lines 134–149). Inside the persist loop, immediately
   after a successful transaction, if `severity_score >= 4` the orchestrator
   calls `notifyHighSeverity`. Wrapped in `try/catch` — a Slack failure is
   only warned, never recorded as a run failure.

6. **Status + log** (lines 164–175). Final status is derived:
   - `failures > 0 && persisted === 0` → `FAILURE`
   - `failures > 0` (some persisted) → `PARTIAL`
   - otherwise → `SUCCESS`
   Then `persistLog` writes the `ingest_logs` row and the `IngestResult` is
   returned to the caller.

---

## 5. Key patterns

### Idempotency via `external_id`
Every normalized item carries `externalId = "${owner}/${repo}#${issue.number}"`,
which maps to the `externalId` unique constraint on `feedback_items`. The
pipeline defends at two levels: a pre-filter `findMany` to skip known items
before paying for an LLM call, and the DB unique constraint as the ultimate
guard against races. Re-running `npm run ingest` yields `itemsNew: 0` — the
README explicitly demos this.

### Per-item failure isolation
Failures are isolated at two granularities:
- **LLM stage**: `analyzeBatch` catches per-item errors into `failures[]`
  rather than aborting the batch.
- **Persist stage**: each item+analysis pair is its own `$transaction`; a DB
  error rolls back only that pair and is recorded, not thrown.

This means a single malformed issue or transient OpenAI error produces a
`PARTIAL` run, not a `FAILURE` that loses the good items.

### `IngestLog` for reliability tracking
Every run — success, partial, failure, or even a fetch error before any items
— writes one row to `ingest_logs` with `runId`, `source`, `status`, counts,
and an `error` blob (either the top-level error or JSON-serialized failures).
This is the audit/reliability surface used to monitor cron health. The
`persistLog` helper is defensively wrapped so a logging failure can never
mask a successful ingest or crash the run.

### Exponential backoff
Backoff is centralized in `utils.ts:backoffDelay` (exponential + jitter, capped)
and `utils.ts:sleep`. It is reused by both `github.ts` (HTTP retries,
rate-limit waits) and `llm.ts` (LLM call retries), so the whole pipeline
shares one retry vocabulary.

### Atomic raw + structured persistence
Wrapping `feedbackItem.create` and `feedbackAnalysis.create` in a single
`$transaction` guarantees you never store a raw item without its analysis (or
vice versa) — preventing partial state if the process dies between the two
writes.

### Best-effort side effects
Both Slack notification and ingest logging are wrapped so they cannot fail the
run. The pipeline's success criterion is "did we persist feedback?", and
everything else is observability/alerting that degrades gracefully.

### Dependency injection for testability
`IngestOptions.fetcher` lets tests swap the GitHub fetcher for a stub, so the
dedupe/analyze/persist/log logic can be tested without network or OpenAI
calls.

---

## 6. How it satisfies the project brief's Cron Pattern A

The README frames the product around two cron patterns. The daily ingest is
**Cron Pattern A** (the README's "Triage (Cron Pattern B)" is the
status-assignment workflow in the UI, which implies the ingest cron is
Pattern A). `runIngest` satisfies every requirement of that pattern:

| Brief requirement | How `ingest.ts` satisfies it |
| --- | --- |
| **Daily cron** | Driven by EventBridge `rate(1 day)` → Lambda → `runIngest`. Locally via `npm run ingest`. |
| **Real data source** | `fetchGitHubIssues` pulls live open issues from a configurable public GitHub repo via the REST API — genuine customer feedback, not seeded demo data. |
| **Ingest & process** | Fetch → dedupe → LLM multi-task analysis (sentiment, topics, severity, summary) → persist raw + structured. |
| **Retry / error logging** | Exponential backoff in both `github.ts` and `llm.ts`; per-item failure isolation; every run recorded in `ingest_logs` with status, counts, and error detail. |
| **Idempotency** | `externalId` unique constraint + pre-filter; safe to re-run. |

The architecture diagram in the README maps the five cron steps directly onto
`runIngest`'s sub-steps:

```
1) Fetch new feedback (GitHub Issues API)   → step 1
2) Deduplicate by external_id               → step 2
3) Call LLM (OpenAI) for structured analysis→ step 3
4) Store analysis + write IngestLog         → steps 4 & 6
5) Slack notify if severity ≥ 4 (bonus)     → step 5
```

---

## 7. The AWS Lambda + EventBridge production path

In production the daily cron is an **AWS SAM**-provisioned Lambda triggered by
EventBridge. The deployment is described in `aws/template.yaml` and the handler
in `aws/lambda/handler.ts` (both in the Infrastructure & Operations Layer,
`layer:infrastructure`).

### The handler (`aws/lambda/handler.ts`)
A 38-line entry point whose entire job is to call `runIngest` and translate the
`IngestResult` into an API Gateway-style HTTP response:

```ts
export const handler = async (_event: ScheduledEvent) => {
  const result = await runIngest();
  const statusCode =
    result.status === "FAILURE" ? 500 : result.status === "PARTIAL" ? 207 : 200;
  return { statusCode, body: JSON.stringify(result) };
};
```

Because it imports the **same** `runIngest` used by the CLI and API route,
behavior is identical across environments — the only difference is the trigger.

### The schedule (`aws/template.yaml`)
- `IngestSchedule` (`AWS::Events::Rule`) with `ScheduleExpression: rate(1 day)`,
  targeting the Lambda.
- `SchedulePermission` grants `events.amazonaws.com` permission to invoke the
  function.
- `IngestFailureAlarm` (CloudWatch) fires when the Lambda reports a failure,
  closing the observability loop on top of `ingest_logs`.

### Configuration
Environment variables are injected on the Lambda function via SAM/Secrets
Manager: `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `GITHUB_REPO`,
`GITHUB_TOKEN`, `INGEST_LOOKBACK_HOURS`, `INGEST_MAX_ITEMS`,
`SLACK_WEBHOOK_URL`. The Lambda runs inside a VPC against RDS Postgres, with
the Prisma client bundled into the deployment zip by `scripts/build-lambda.ts`
(Lambda cannot run `prisma generate` at runtime).

### The three-environment invariant
The knowledge-graph tour's final step summarizes the design goal:

> "The same ingest pipeline thus runs from npm, an API route, or Lambda
> without code changes."

`runIngest` is the single shared seam that makes this true. Whether you run
`npm run ingest` locally, `POST /api/ingest` from the UI, or wait for the
daily EventBridge tick in production, the exact same fetch → dedupe → analyze
→ persist → notify → log sequence executes against the same database schema.

---

## 8. Knowledge-graph summary

- **Node**: `file:src/lib/ingest.ts` — type `file`, complexity `complex`,
  tags `service / ingest / data-pipeline / orchestration / serialization`.
- **Contains**: `function:src/lib/ingest.ts:runIngest` (lines 37–176,
  complex) and `function:src/lib/ingest.ts:persistLog` (lines 178–195).
- **Exports**: `runIngest` (weight 0.8).
- **Imports** (outgoing, weight 0.7): `github.ts`, `llm.ts`, `prisma.ts`,
  `slack.ts`, `types.ts`.
- **Imported by** (incoming): `aws/lambda/handler.ts`, `scripts/ingest.ts`,
  `src/app/api/ingest/route.ts`.
- **Called by**: `aws/lambda/handler.ts:handler`,
  `src/app/api/ingest/route.ts:POST`.
- **Calls**: `llm.ts:analyzeBatch`, `slack.ts:notifyHighSeverity`.
- **Layer**: `layer:service` (Service Layer).
- **Tour step**: 6 of 12, "Ingest Pipeline Orchestrator".
