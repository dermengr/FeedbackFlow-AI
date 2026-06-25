import { Octokit } from "@octokit/rest";
import { RawFeedbackItem } from "@/lib/types";
import { backoffDelay, sleep } from "@/lib/utils";

// ---------------------------------------------------------------------------
// GitHub Issues API ingestion
//
// We treat open issues from a configurable public repo as "bug reports" /
// customer feedback. This is a stable, free, well-documented REST API and is
// far more reliable for a daily cron than scraping Trustpilot/Capterra.
//
// Idempotency is handled downstream by `externalId` = `${repo}#${issueNumber}`.
// ---------------------------------------------------------------------------

const SOURCE = "GitHubIssues";

function getRepo(): { owner: string; repo: string } {
  const raw = process.env.GITHUB_REPO ?? "vercel/next.js";
  const [owner, repo] = raw.split("/");
  if (!owner || !repo) {
    throw new Error(`GITHUB_REPO must be in "owner/repo" form, got "${raw}"`);
  }
  return { owner, repo };
}

function getLookbackHours(): number {
  const v = Number(process.env.INGEST_LOOKBACK_HOURS);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

function getMaxItems(): number {
  const v = Number(process.env.INGEST_MAX_ITEMS);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

function createOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  return new Octokit({
    auth: token || undefined,
    // Be polite to the API.
    request: { fetch },
  });
}

interface RateLimitInfo {
  remaining: number;
  reset: number; // epoch seconds
}

function parseRateLimit(headers: Headers | Record<string, unknown>): RateLimitInfo | null {
  const get = (k: string): string | undefined => {
    if (headers instanceof Headers) return headers.get(k) ?? undefined;
    const h = headers as Record<string, unknown>;
    return (h[k] as string) ?? (h[k.toLowerCase()] as string) ?? undefined;
  };
  const remaining = get("x-ratelimit-remaining");
  const reset = get("x-ratelimit-reset");
  if (remaining === undefined || reset === undefined) return null;
  return { remaining: Number(remaining), reset: Number(reset) };
}

async function waitForRateLimit(info: RateLimitInfo): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const waitSec = Math.max(info.reset - now, 0) + 1;
  // Cap the wait so a cron doesn't hang forever; if reset is far away, bail.
  if (waitSec > 60) {
    throw new Error(
      `GitHub rate limit exhausted; reset in ${waitSec}s exceeds 60s cap. Aborting.`
    );
  }
  console.warn(`[github] rate limit low, waiting ${waitSec}s for reset...`);
  await sleep(waitSec * 1000);
}

// Fetch open issues created within the lookback window, with retry + backoff
// and rate-limit awareness. Returns normalized RawFeedbackItem[].
export async function fetchGitHubIssues(): Promise<RawFeedbackItem[]> {
  const { owner, repo } = getRepo();
  const lookbackHours = getLookbackHours();
  const maxItems = getMaxItems();
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const octokit = createOctokit();
  const items: RawFeedbackItem[] = [];
  let page = 1;
  const perPage = Math.min(100, maxItems);
  const maxAttempts = 4;

  while (items.length < maxItems) {
    let success = false;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= maxAttempts && !success; attempt++) {
      try {
        const res = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state: "open",
          since: since.toISOString(),
          sort: "created",
          direction: "desc",
          per_page: perPage,
          page,
        });

        const rl = parseRateLimit(res.headers as Record<string, unknown>);
        if (rl && rl.remaining <= 1) {
          await waitForRateLimit(rl);
        }

        const data = res.data;
        if (data.length === 0) {
          // No more results.
          return items;
        }

        for (const issue of data) {
          // PRs also show up in the issues endpoint; skip them.
          if ("pull_request" in issue && issue.pull_request) continue;
          if (items.length >= maxItems) break;

          const body = issue.body ?? "";
          const title = issue.title ?? "";
          const rawContent = body.trim().length > 0 ? `${title}\n\n${body}` : title;

          items.push({
            source: SOURCE,
            externalId: `${owner}/${repo}#${issue.number}`,
            title,
            rawContent,
            authorLogin: issue.user?.login ?? null,
            url: issue.html_url,
            originalTimestamp: new Date(issue.created_at),
          });
        }

        success = true;
        // If the page wasn't full, there are no more pages.
        if (data.length < perPage) return items;
        page++;
      } catch (err) {
        lastErr = err;
        const status = (err as { status?: number }).status;
        // 404 / 401 / 403 (forbidden, not rate limit) -> don't retry.
        if (status === 404 || status === 401) {
          throw new Error(
            `GitHub API ${status} for ${owner}/${repo}: ${(err as Error).message}`
          );
        }
        // Rate limit 403 with retry-after / ratelimit headers.
        if (status === 403) {
          const rl = parseRateLimit((err as { headers?: Record<string, unknown> }).headers ?? {});
          if (rl && rl.remaining <= 1) {
            await waitForRateLimit(rl);
            // retry without counting as a backoff attempt
            attempt--;
            continue;
          }
        }
        if (attempt < maxAttempts) {
          const delay = backoffDelay(attempt);
          console.warn(
            `[github] attempt ${attempt}/${maxAttempts} failed (${status ?? "err"}), retrying in ${delay}ms`
          );
          await sleep(delay);
        }
      }
    }

    if (!success) {
      throw new Error(
        `GitHub issues fetch failed after ${maxAttempts} attempts: ${(lastErr as Error)?.message ?? lastErr}`
      );
    }
  }

  return items;
}

export const GITHUB_SOURCE = SOURCE;
