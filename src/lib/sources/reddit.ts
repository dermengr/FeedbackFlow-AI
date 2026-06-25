import { RawFeedbackItem } from "@/lib/types";
import { sleep } from "@/lib/utils";

// ---------------------------------------------------------------------------
// A1: Reddit ingestion adapter
//
// Fetches top posts from configurable subreddits via Reddit's public JSON
// API (https://www.reddit.com/r/{sub}/top.json). No OAuth required for
// read-only public data, but a custom User-Agent is recommended.
//
// Config (SourceConfig.config JSON):
//   { "subreddits": ["nextjs", "webdev"], "lookbackHours": 24, "maxItems": 50 }
// ---------------------------------------------------------------------------

export const REDDIT_SOURCE = "Reddit";

export interface RedditConfig {
  subreddits: string[];
  lookbackHours?: number;
  maxItems?: number;
}

function getUserAgent(): string {
  return process.env.REDDIT_USER_AGENT ?? "FeedbackFlowAI/1.0";
}

function getLookbackHours(cfg?: number): number {
  const v = cfg ?? Number(process.env.INGEST_LOOKBACK_HOURS);
  return Number.isFinite(v) && v > 0 ? v : 24;
}

function getMaxItems(cfg?: number): number {
  const v = cfg ?? Number(process.env.INGEST_MAX_ITEMS);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  author: string;
  permalink: string;
  created_utc: number;
  subreddit: string;
  url: string;
}

async function fetchSubreddit(
  sub: string,
  lookbackHours: number,
  maxItems: number
): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?t=day&limit=${Math.min(maxItems, 100)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": getUserAgent() },
  });
  if (!res.ok) {
    throw new Error(`Reddit fetch failed for r/${sub}: ${res.status}`);
  }
  const data = await res.json();
  const children: Array<{ data: RedditPost }> = data?.data?.children ?? [];
  const cutoff = Date.now() / 1000 - lookbackHours * 3600;
  return children
    .map((c) => c.data)
    .filter((p) => p.created_utc >= cutoff);
}

export async function fetchRedditPosts(
  config: RedditConfig
): Promise<RawFeedbackItem[]> {
  const lookback = getLookbackHours(config.lookbackHours);
  const maxItems = getMaxItems(config.maxItems);
  const results: RawFeedbackItem[] = [];

  for (const sub of config.subreddits) {
    try {
      const posts = await fetchSubreddit(sub, lookback, maxItems);
      for (const p of posts) {
        const content = p.selftext?.trim()
          ? `${p.title}\n\n${p.selftext}`
          : p.title;
        results.push({
          source: REDDIT_SOURCE,
          externalId: `reddit:${p.subreddit}:${p.id}`,
          title: p.title,
          rawContent: content.slice(0, 8000),
          authorLogin: p.author,
          url: `https://www.reddit.com${p.permalink}`,
          originalTimestamp: new Date(p.created_utc * 1000),
        });
        if (results.length >= maxItems) break;
      }
    } catch (err) {
      console.warn(`[reddit] failed r/${sub}: ${(err as Error).message}`);
    }
    // Be polite between subreddits.
    await sleep(500);
  }

  return results.slice(0, maxItems);
}
