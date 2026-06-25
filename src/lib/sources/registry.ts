import { prisma } from "@/lib/prisma";
import { RawFeedbackItem } from "@/lib/types";
import { fetchGitHubIssues, GITHUB_SOURCE } from "@/lib/github";
import { fetchRedditPosts, RedditConfig, REDDIT_SOURCE } from "./reddit";
import { fetchRssFeed, RssConfig, RSS_SOURCE } from "./rss";

// ---------------------------------------------------------------------------
// A4: Source registry + multi-source ingest
//
// Maps adapter types to fetcher functions and provides a single entry point
// to run all enabled SourceConfigs (plus the legacy default GitHub source).
// The ingest orchestrator (src/lib/ingest.ts) is unchanged for backward
// compatibility; runMultiSourceIngest iterates over the registry.
// ---------------------------------------------------------------------------

export type AdapterType = "github" | "reddit" | "rss" | "csv";

export interface SourceFetcher {
  (config: Record<string, unknown>): Promise<RawFeedbackItem[]>;
}

const ADAPTERS: Record<AdapterType, SourceFetcher> = {
  github: async (config) => {
    // GitHub uses env vars for now; config can override repo at runtime.
    if (config.owner && config.repo) {
      process.env.GITHUB_REPO = `${config.owner}/${config.repo}`;
    }
    return fetchGitHubIssues();
  },
  reddit: async (config) =>
    fetchRedditPosts(config as unknown as RedditConfig),
  rss: async (config) => fetchRssFeed(config as unknown as RssConfig),
  csv: async () => {
    // CSV is upload-driven, not cron-driven. Return empty for cron runs.
    return [];
  },
};

export function getAdapter(type: string): SourceFetcher | null {
  return (ADAPTERS as Record<string, SourceFetcher>)[type] ?? null;
}

// Seed the default GitHub source config if none exists. Called on app boot
// and before multi-source runs to ensure a baseline source is present.
export async function ensureDefaultSourceConfig(): Promise<void> {
  const exists = await prisma.sourceConfig.findFirst({
    where: { sourceKey: { startsWith: "github:" } },
  });
  if (exists) return;
  const repo = process.env.GITHUB_REPO ?? "vercel/next.js";
  const [owner, repoName] = repo.split("/");
  await prisma.sourceConfig.create({
    data: {
      sourceKey: `github:${repo}`,
      label: `GitHub Issues — ${repo}`,
      adapter: "github",
      config: { owner, repo: repoName },
      enabled: true,
    },
  });
}

export interface MultiSourceRunResult {
  totalFetched: number;
  perSource: Array<{
    sourceKey: string;
    label: string;
    fetched: number;
    error?: string;
  }>;
}

// Run all enabled SourceConfigs and return the combined raw items plus a
// per-source summary. The caller (ingest orchestrator) is responsible for
// dedup + LLM analysis + persistence.
export async function fetchAllSources(): Promise<{
  items: RawFeedbackItem[];
  summary: MultiSourceRunResult;
}> {
  const configs = await prisma.sourceConfig.findMany({
    where: { enabled: true },
  });

  const allItems: RawFeedbackItem[] = [];
  const perSource: MultiSourceRunResult["perSource"] = [];

  for (const cfg of configs) {
    const adapter = getAdapter(cfg.adapter);
    if (!adapter) {
      perSource.push({
        sourceKey: cfg.sourceKey,
        label: cfg.label,
        fetched: 0,
        error: `Unknown adapter: ${cfg.adapter}`,
      });
      continue;
    }
    try {
      const configObj =
        cfg.config && typeof cfg.config === "object"
          ? (cfg.config as Record<string, unknown>)
          : {};
      const items = await adapter(configObj);
      allItems.push(...items);
      perSource.push({
        sourceKey: cfg.sourceKey,
        label: cfg.label,
        fetched: items.length,
      });
    } catch (err) {
      perSource.push({
        sourceKey: cfg.sourceKey,
        label: cfg.label,
        fetched: 0,
        error: (err as Error).message,
      });
    }
  }

  return {
    items: allItems,
    summary: { totalFetched: allItems.length, perSource },
  };
}

// Map a SourceConfig adapter to the legacy source label stored on
// FeedbackItem.source (for backward compat with existing GitHub items).
export function adapterToSourceLabel(adapter: AdapterType): string {
  switch (adapter) {
    case "github":
      return GITHUB_SOURCE;
    case "reddit":
      return REDDIT_SOURCE;
    case "rss":
      return RSS_SOURCE;
    case "csv":
      return "CSVUpload";
  }
}
