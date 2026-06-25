# FeedbackFlow AI - AWS Deployment

This directory contains the infrastructure-as-code and deployment guide for
running FeedbackFlow AI on AWS.

## Architecture

```
                     ┌───────────────────────────┐
                     │   AWS Amplify (Next.js)    │
                     │   feedbackflow.<domain>    │
                     └─────────────┬─────────────┘
                                   │ HTTPS
                     ┌─────────────▼─────────────┐
                     │  RDS Postgres (private)    │
                     │  users / feedback_items /  │
                     │  feedback_analyses / logs  │
                     └─────────────▲─────────────┘
                                   │
   ┌────────────────┐    ┌─────────┴───────────┐
   │  EventBridge    │───▶│  Lambda (ingest)    │
   │  rate(1 day)    │    │  - fetch GitHub     │
   └────────────────┘    │  - dedupe           │
                         │  - OpenAI analyze   │
                         │  - persist          │
                         │  - Slack notify     │
                         └─────────┬───────────┘
                                   │
                         ┌─────────▼─────────┐
                         │  GitHub / OpenAI  │
                         │  / Slack (bonus)  │
                         └───────────────────┘
```

- **Frontend + API:** Next.js 14 (App Router) on AWS Amplify Hosting with a
  custom domain. Amplify runs the Next.js server runtime (SSR + API routes).
- **Database:** Amazon RDS Postgres 16 in a VPC private subnet.
- **Cron:** AWS Lambda (Node 20) triggered daily by an EventBridge schedule
  rule. The Lambda reuses the same `runIngest()` orchestration as the local
  script and the `POST /api/ingest` route.
- **Secrets:** DB credentials in AWS Secrets Manager; OpenAI/GitHub/Slack keys
  passed as Lambda environment variables (set via SAM parameters).
- **Observability:** CloudWatch Logs for the Lambda + a CloudWatch Alarm that
  fires on Lambda errors.

## Prerequisites

- AWS account + AWS CLI configured (`aws configure`) with admin/operator perms.
- AWS SAM CLI installed (`sam --version`). Install via:
  `pip install aws-sam-cli` or the official installer.
- Node 20+ locally for building the bundle.
- A registered domain (e.g. `feedbackflow.dev`) — required by the brief. You
  can register one via Route 53 or any registrar and point it at Amplify.

## 1. Deploy the backend (RDS + Lambda + EventBridge)

All commands run from the `aws/` directory.

```bash
cd aws

# Validate the template
sam validate

# Build (bundles the Lambda handler via esbuild)
sam build

# Deploy with guided prompts (first run). Provide:
#   - DbMasterPassword (>= 8 chars)
#   - OpenAiApiKey
#   - GitHubToken (recommended)
#   - SlackWebhookUrl (optional)
sam deploy --guided --stack-name feedbackflow-ai
```

After deploy, note the `RdsEndpoint` output. Your `DATABASE_URL` for the
frontend will be:

```
postgresql://<DbMasterUsername>:<DbMasterPassword>@<RdsEndpoint>:5432/<DbName>?schema=public
```

### Run the schema migration against RDS

From the repo root, with `DATABASE_URL` pointing at the RDS endpoint:

```bash
DATABASE_URL="postgresql://feedbackflow:<pwd>@<RdsEndpoint>:5432/feedbackflow?schema=public" \
  npx prisma migrate deploy
```

`migrate deploy` (not `migrate dev`) is the correct command for production — it
applies the migrations already committed under `prisma/migrations/` without
prompting.

### Test the Lambda manually

```bash
aws lambda invoke --function-name $(sam list resources --stack-name feedbackflow-ai --output json | jq -r '.[] | select(.LogicalResourceId=="IngestFunction") | .PhysicalResourceId') out.json
cat out.json
```

Or trigger via the EventBridge schedule in the AWS console (Events → Rules →
"FeedbackFlowIngestSchedule" → Trigger).

## 2. Deploy the frontend on Amplify

1. Push the repo to GitHub.
2. In the AWS Console, open **Amplify** → **Hosted apps** → **New app** →
   connect your GitHub repo.
3. Amplify auto-detects `amplify.yml` at the repo root (Next.js settings).
4. Under **App settings → Environment variables**, add:
   - `DATABASE_URL` — the RDS connection string from step 1.
   - `NEXTAUTH_URL` — `https://feedbackflow.<your-domain>` (your custom domain).
   - `NEXTAUTH_SECRET` — `openssl rand -base64 32`.
   - `OPENAI_API_KEY` — same key as the Lambda.
   - `OPENAI_MODEL` — `gpt-4o-mini`.
   - `GITHUB_REPO`, `GITHUB_TOKEN`, `INGEST_LOOKBACK_HOURS`, `INGEST_MAX_ITEMS`.
   - `SLACK_WEBHOOK_URL` (optional, bonus).
5. **Domain:** Amplify → App settings → Domain management → Add domain → enter
   your custom domain (e.g. `feedbackflow.dev`). Configure the DNS records
   Amplify shows you (CNAME to the Amplify domain, or delegate via Route 53).
   Wait for "Verified" + SSL provisioning.
6. Trigger a deploy (or push a commit). Once green, visit the custom domain.

> Free Amplify preview URLs alone are **not** sufficient per the brief — a
> custom domain is required.

## 3. Demo video checklist

When recording the demo, show:

1. **Amplify dashboard** — the deployed app + connected custom domain
   (Domain management tab showing "Verified").
2. **New data in the UI** — log in, open the Dashboard/Inbox, point out items
   ingested by the cron.
3. **Cron execution** — CloudWatch Logs for the `IngestFunction` showing the
   EventBridge invocation → fetch → analyze → store. Show the EventBridge rule
   and the most recent successful invocation.
4. **RDS** — briefly show the RDS console (instance, the `feedbackflow` DB,
   tables populated).
5. **Secrets** — show Secrets Manager holding the DB secret, and that no secret
   is hardcoded in the repo (point at `.env.example` placeholders).

## Cost notes

- RDS `db.t4g.micro` + 20GB gp3 is within the AWS free tier (12 months).
- Lambda + EventBridge: effectively free at 1 invocation/day.
- Amplify Hosting: free tier covers 5GB egress + 1000 build minutes/month.
- NAT Gateway: ~$32/month — the largest cost. To avoid it during a short demo,
  you may place the Lambda in public subnets (not recommended for production)
  or use a VPC without NAT and give the Lambda public IPs via a NAT instance.
