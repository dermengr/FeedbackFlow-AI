import { RawFeedbackItem } from "@/lib/types";

// ---------------------------------------------------------------------------
// A2: RSS/Atom feed ingestion adapter
//
// Fetches entries from any RSS 2.0 or Atom 1.0 feed. Uses a lightweight
// regex-based parser to avoid adding a heavy XML dependency; feeds are
// expected to be well-formed XML with standard <item> or <entry> elements.
//
// Config (SourceConfig.config JSON):
//   { "feedUrl": "https://example.com/feed.xml", "lookbackHours": 48, "maxItems": 50 }
// ---------------------------------------------------------------------------

export const RSS_SOURCE = "RSS";

export interface RssConfig {
  feedUrl: string;
  lookbackHours?: number;
  maxItems?: number;
}

function getLookbackHours(cfg?: number): number {
  const v = cfg ?? Number(process.env.INGEST_LOOKBACK_HOURS);
  return Number.isFinite(v) && v > 0 ? v : 48;
}

function getMaxItems(cfg?: number): number {
  const v = cfg ?? Number(process.env.INGEST_MAX_ITEMS);
  return Number.isFinite(v) && v > 0 ? v : 50;
}

// Minimal XML tag extractor. Returns the inner text of the first <tag>...
// </tag> within the given XML fragment.
function tagContent(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

// Extract the first matching element's inner XML for iteration.
function allTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

// Strip CDATA wrappers and HTML entities to plain text.
function cleanText(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface RssEntry {
  title: string;
  content: string;
  link: string;
  author: string | null;
  pubDate: Date | null;
  guid: string;
}

export function parseRssFeed(xml: string): RssEntry[] {
  // Try RSS 2.0 <item> first, then Atom <entry>.
  let entries = allTags(xml, "item");
  let isAtom = false;
  if (entries.length === 0) {
    entries = allTags(xml, "entry");
    isAtom = true;
  }

  return entries.map((e): RssEntry => {
    if (isAtom) {
      const title = cleanText(tagContent(e, "title") ?? "Untitled");
      const content =
        cleanText(tagContent(e, "content") ?? "") ||
        cleanText(tagContent(e, "summary") ?? "");
      const linkEl = e.match(/<link[^>]*href="([^"]+)"/i);
      const link = linkEl ? linkEl[1] : cleanText(tagContent(e, "link") ?? "") || "";
      const author = cleanText(tagContent(e, "name") ?? tagContent(e, "author") ?? "") || null;
      const pub = parseDate(tagContent(e, "published") ?? tagContent(e, "updated"));
      const guid = cleanText(tagContent(e, "id") ?? link) || title;
      return { title, content, link, author, pubDate: pub, guid };
    }
    const title = cleanText(tagContent(e, "title") ?? "Untitled");
    const content =
      cleanText(tagContent(e, "content:encoded") ?? "") ||
      cleanText(tagContent(e, "description") ?? "");
    const link = cleanText(tagContent(e, "link") ?? "") || "";
    const author = cleanText(tagContent(e, "author") ?? tagContent(e, "dc:creator") ?? "") || null;
    const pub = parseDate(tagContent(e, "pubDate") ?? tagContent(e, "dc:date"));
    const guid = cleanText(tagContent(e, "guid") ?? link) || title;
    return { title, content, link, author, pubDate: pub, guid };
  });
}

export async function fetchRssFeed(
  config: RssConfig
): Promise<RawFeedbackItem[]> {
  const lookback = getLookbackHours(config.lookbackHours);
  const maxItems = getMaxItems(config.maxItems);
  const cutoff = Date.now() - lookback * 3600 * 1000;

  const res = await fetch(config.feedUrl, {
    headers: { "User-Agent": "FeedbackFlowAI/1.0" },
  });
  if (!res.ok) {
    throw new Error(`RSS fetch failed (${res.status}) for ${config.feedUrl}`);
  }
  const xml = await res.text();
  const entries = parseRssFeed(xml);

  const feedHost = (() => {
    try {
      return new URL(config.feedUrl).hostname;
    } catch {
      return "feed";
    }
  })();

  const out: RawFeedbackItem[] = [];
  for (const e of entries) {
    const ts = e.pubDate ?? new Date();
    if (ts.getTime() < cutoff) continue;
    out.push({
      source: RSS_SOURCE,
      externalId: `rss:${feedHost}:${e.guid}`,
      title: e.title,
      rawContent: (e.content || e.title).slice(0, 8000),
      authorLogin: e.author,
      url: e.link || null,
      originalTimestamp: ts,
    });
    if (out.length >= maxItems) break;
  }

  return out;
}
