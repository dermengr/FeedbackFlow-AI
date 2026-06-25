# LLM Integration Module — `src/lib/llm.ts`

> A deep-dive explanation generated from the FeedbackFlow AI knowledge graph and source.

## 1. Role in the Architecture

`src/lib/llm.ts` is the **core LLM processing engine** of FeedbackFlow AI. It lives in the
**Service Layer** (knowledge-graph layer `layer:service`), alongside the ingest orchestrator
(`ingest.ts`), the GitHub ingestion adapter (`github.ts`), Slack notifications (`slack.ts`),
NextAuth config (`auth.ts`), the Prisma client singleton (`prisma.ts`), and request-protection
middleware.

The Service Layer's mandate, per the graph, is *"Core business logic and domain services in
`src/lib`."* Within that layer, `llm.ts` is the single component responsible for turning
**raw, unstructured customer feedback** into the **structured analysis** that powers the rest of
the product (inbox triage, dashboard analytics, severity-based Slack alerts).

Knowledge-graph node metadata:

| Field | Value |
| --- | --- |
| Node ID | `file:src/lib/llm.ts` |
| Type | `file` |
| Summary | OpenAI analysis module that builds prompts from feedback items, calls chat completions, validates responses with a Zod schema, and supports batch analysis with retry/backoff. |
| Tags | `service`, `api-handler`, `validation`, `data-pipeline` |
| Complexity | `moderate` |
| Language notes | Uses Zod schema parsing (`AnalysisSchema.parse`) to validate LLM JSON output and shared backoff helpers for retries. |

This is the module that directly satisfies the project brief's **LLM Integration** requirement:
sentiment analysis, topic classification, severity scoring (1–5), and summarization — all
performed in a single multi-task call per feedback item.

## 2. Internal Structure

The file is 141 lines and contains three function nodes (all `contains` edges from the file node),
two of which are exported (`exports` edges):

| Function | Lines | Exported | Purpose |
| --- | --- | --- | --- |
| `buildUserPrompt` | 37–47 | no (private helper) | Compose the user-turn prompt from a `RawFeedbackItem`. |
| `analyzeFeedback` | 64–116 | yes | Analyze a single item with retry/backoff; returns a validated `LlmAnalysisResult`. |
| `analyzeBatch` | 124–141 | yes | Loop over items, isolate per-item failures, return `{ results, failures }`. |

Supporting module-level constructs:

- **`AnalysisSchema`** (lines 18–27) — a Zod object schema that is the contract between the model
  and the rest of the system.
- **`SYSTEM_PROMPT`** (lines 29–35) — the fixed system instruction that turns GPT into a
  "senior product support analyst" and enumerates the four required tasks plus the topic
  taxonomy.
- **`getClient()`** (49–53) — lazily constructs an `OpenAI` client from `OPENAI_API_KEY`,
  throwing if unset.
- **`getModel()`** (55–57) — returns `process.env.OPENAI_MODEL ?? "gpt-4o-mini"`.
- **`AnalyzeOptions`** / `BatchAnalyzeResult`** interfaces — typed option bags.

### 2.1 `buildUserPrompt(item: RawFeedbackItem)`

Assembles a compact, metadata-prefixed user message:

```
Analyze the following feedback.

Source: github
Author: <login>
Title: <title>

Content:
<rawContent, truncated to 8000 chars>
```

Only non-null metadata lines are included (`Author`/`Title` are omitted when absent), and the
raw content is hard-capped at 8000 characters to keep token usage bounded.

### 2.2 `analyzeFeedback(item, opts)`

The heart of the module. For each attempt (default `maxAttempts = 3`):

1. Calls `client.chat.completions.create` with:
   - `model` from `getModel()`,
   - `temperature: 0` for deterministic output,
   - `response_format: { type: "json_object" }` to force valid JSON,
   - a two-message array: the fixed `SYSTEM_PROMPT` and the per-item `buildUserPrompt(item)`.
2. Extracts `choices[0].message.content`; throws "Empty LLM response" if blank.
3. `JSON.parse`s the content (wrapping parse errors as "LLM returned invalid JSON: ...").
4. Validates the parsed object with `AnalysisSchema.parse(parsed)` — the Zod boundary.
5. On success, returns the validated `LlmAnalysisResult`.

On any thrown error, it logs a warning (`[llm] attempt N/M failed for <externalId>: ...`),
computes a delay via `backoffDelay(attempt)` from `utils.ts`, `sleep`s, and retries. After all
attempts are exhausted it throws a descriptive aggregate error. The retry intentionally covers
both network/5xx/rate-limit errors *and* occasional malformed JSON, because a second call often
self-corrects.

### 2.3 `analyzeBatch(items, opts)`

A sequential, failure-isolating wrapper. It iterates the items, calls `analyzeFeedback` for
each, and partitions the outcome into:

- `results: Array<{ item, analysis }>` — successful analyses,
- `failures: Array<{ item, error }>` — items whose analysis threw.

This guarantees that **one bad item never aborts the whole ingest run**; the caller (`ingest.ts`)
persists whatever succeeded and records the rest as failures.

## 3. The Zod Contract — `AnalysisSchema`

```ts
const AnalysisSchema = z.object({
  sentiment: z.enum(SENTIMENTS),                       // "positive" | "neutral" | "negative"
  topics: z.array(z.string()).min(1).max(6)
            .transform((arr) => arr.slice(0, 6)),      // 1–6 topic strings, hard-capped
  severity_score: z.number().int().min(1).max(5),      // integer 1..5
  summary: z.string().min(1).max(300),                 // non-empty, ≤300 chars
});
```

The schema is the single source of truth for the LLM's output shape and is what makes the
"structured JSON output" pattern robust: even though the model is instructed to return exactly
these keys, Zod enforces it at runtime. The inferred output type matches `LlmAnalysisResult`
from `types.ts`:

```ts
export interface LlmAnalysisResult {
  sentiment: Sentiment;
  topics: string[];
  severity_score: number; // 1-5
  summary: string;
}
```

Note the `topics` array is typed as `string[]` (not the narrower `Topic` union) — the model is
*encouraged* to use the taxonomy but is not strictly constrained to it, so the schema accepts
any strings and merely caps the count at six.

## 4. External Connections (Neighborhood)

From the knowledge-graph edges involving `file:src/lib/llm.ts` and its contained functions:

### 4.1 Imports (this module depends on)

| Edge | Target | What's used |
| --- | --- | --- |
| `imports` | `file:src/lib/types.ts` | `LlmAnalysisResult`, `RawFeedbackItem`, `SENTIMENTS`, `TOPIC_TAXONOMY` |
| `imports` | `file:src/lib/utils.ts` | `backoffDelay`, `sleep` |

It also imports the `openai` and `zod` packages directly. Notably, it does **not** import
`prisma.ts` itself — it is a pure analysis function with no DB awareness. Persistence is the
caller's job, keeping this module focused and testable.

### 4.2 Call edges from this module

| Edge | Target | Where |
| --- | --- | --- |
| `calls` | `function:src/lib/utils.ts:backoffDelay` | inside `analyzeFeedback`'s retry loop |
| `calls` | `function:src/lib/utils.ts:sleep` | inside `analyzeFeedback`'s retry loop |

### 4.3 Containment / export edges

- `contains` → `buildUserPrompt`, `analyzeFeedback`, `analyzeBatch`
- `exports` → `analyzeFeedback`, `analyzeBatch` (the public surface)

### 4.4 Consumers (this module is depended on by)

| Edge | Source | Usage |
| --- | --- | --- |
| `imports` | `file:src/lib/ingest.ts` | `import { analyzeBatch } from "@/lib/llm"` |
| `calls` | `function:src/lib/ingest.ts:runIngest` → `analyzeBatch` | step 3 of the ingest pipeline |

`ingest.ts` is itself invoked from three places (per its own header comment): the local cron
runner `scripts/ingest.ts`, the AWS Lambda handler `aws/lambda/handler.ts`, and the manual
`POST /api/ingest` route. So `llm.ts` is ultimately reached by **every trigger path** in the
system.

### 4.5 Non-code relationships

- `configures` from `config:.env.example` — the module reads `OPENAI_API_KEY` and `OPENAI_MODEL`.
- `documents` from `document:README.md` — the module is described in project docs.

## 5. Data Flow

End-to-end, for one feedback item:

```
RawFeedbackItem (from github.ts)
        │
        ▼
buildUserPrompt(item)        ── metadata + truncated content (≤8000 chars)
        │
        ▼
OpenAI chat.completions.create
   • model: gpt-4o-mini (default)
   • temperature: 0
   • response_format: json_object
   • messages: [SYSTEM_PROMPT, user prompt]
        │
        ▼  (raw JSON string)
JSON.parse
        │
        ▼
AnalysisSchema.parse (Zod)   ── validates sentiment/topics/severity/summary
        │
        ▼
LlmAnalysisResult            ── returned to caller
        │
        ▼ (in ingest.ts)
prisma.feedbackAnalysis.create  ── persisted alongside the FeedbackItem
        │
        ▼ (severity_score >= 4)
slack.notifyHighSeverity     ── best-effort alert
```

On any failure in the `JSON.parse`/`parse`/API-call path, the loop backs off
(`backoffDelay`: `2^(attempt-1) * 1000` ms, capped at 30s, +≤500ms jitter) and retries up to
`maxAttempts`. `analyzeBatch` wraps this so a per-item throw becomes a `failures` entry rather
than an aborted run.

## 6. Key Patterns

1. **Structured JSON output via `response_format: { type: "json_object" }`.**
   The OpenAI JSON mode guarantees syntactically valid JSON; the `SYSTEM_PROMPT` then pins the
   exact keys. This is the primary reliability mechanism for the LLM step.

2. **Zod schema validation as the trust boundary.**
   `AnalysisSchema.parse` is the single point that converts untrusted model output into a typed
   `LlmAnalysisResult`. The `topics` array uses `.transform` to hard-cap length even if the
   model over-emits.

3. **Multi-task analysis in one call.**
   Rather than four separate prompts (sentiment, topics, severity, summary), the system prompt
   asks for all four in a single completion. This minimizes cost/latency and lets the model
   produce a self-consistent summary informed by the same reasoning it used for sentiment and
   severity.

4. **Exponential backoff with jittered retry.**
   `backoffDelay` + `sleep` (shared with `github.ts`) implement capped exponential backoff with
   jitter. The retry covers both transient API errors and the occasional malformed JSON that a
   re-call fixes.

5. **Failure isolation at the batch boundary.**
   `analyzeBatch` never lets one item's exception propagate; it collects `failures` so the
   ingest pipeline can persist the survivors and report partial status.

6. **Determinism via `temperature: 0`.**
   Analysis is treated as a classification/extraction task, so sampling is disabled for
   reproducible triage decisions.

7. **Config-driven model selection.**
   `OPENAI_MODEL` env override (default `gpt-4o-mini`) lets operators swap models without code
   changes; `OPENAI_API_KEY` presence is checked explicitly with a clear error.

8. **Pure service, no persistence coupling.**
   The module imports neither `prisma.ts` nor any route handler. It takes `RawFeedbackItem`s in
   and returns `LlmAnalysisResult`s out, making it trivially unit-testable with a mocked
   `OpenAI` client.

## 7. How It Satisfies the Project Brief's LLM Integration Requirement

The FeedbackFlow AI brief requires an automated pipeline that ingests real public feedback and
runs a multi-task LLM analysis producing, per item: **sentiment**, **topic classification**,
**severity score (1–5)**, and a **summary**. `llm.ts` is the exact component that delivers this:

| Brief requirement | Implementation in `llm.ts` |
| --- | --- |
| Sentiment analysis | `sentiment: z.enum(SENTIMENTS)` with `SENTIMENTS = ["positive","neutral","negative"]` from `types.ts`; instructed in `SYSTEM_PROMPT` task 1. |
| Topic classification | `topics: z.array(z.string()).min(1).max(6)`; `SYSTEM_PROMPT` task 2 constrains choices to `TOPIC_TAXONOMY` (Bug Report, Feature Request, Pricing, Performance, UX/UI, Documentation, Security, Integration, Customer Support, Onboarding, Other). |
| Severity scoring 1–5 | `severity_score: z.number().int().min(1).max(5)`; `SYSTEM_PROMPT` task 3 defines the scale (1 trivial → 5 critical/data loss/outage, 4–5 reserved for urgent core-functionality issues). |
| Summarization | `summary: z.string().min(1).max(300)`; `SYSTEM_PROMPT` task 4 asks for a single concise sentence (≤200 chars). |
| Reliability | JSON mode + Zod validation + exponential backoff retry + batch failure isolation. |
| Cost control | Default `gpt-4o-mini`, content truncated to 8000 chars, single multi-task call per item. |

The validated `LlmAnalysisResult` is then consumed by `ingest.ts`, which persists it as a
`FeedbackAnalysis` row (sentiment, topics, severityScore, summary, status `NEW`) linked to the
raw `FeedbackItem`, and triggers a Slack alert when `severity_score >= 4`. From there the inbox
UI (`src/app/(app)/inbox/...`) and dashboard read the structured fields to filter, sort, badge,
and triage — none of which would be possible without the disciplined, schema-validated
extraction performed here.

In short: `llm.ts` is the cognitive core of FeedbackFlow AI — a small, focused, pure service
that converts noisy human feedback into the structured signal the rest of the product is built
on.
