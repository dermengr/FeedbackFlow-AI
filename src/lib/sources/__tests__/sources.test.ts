import { describe, it, expect } from "vitest";
import { parseRssFeed } from "@/lib/sources/rss";
import { parseCsvUpload } from "@/lib/sources/csv";

describe("RSS adapter", () => {
  describe("parseRssFeed", () => {
    it("parses RSS 2.0 items", () => {
      const xml = `<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Test Feed</title>
            <item>
              <title>First post</title>
              <link>https://example.com/1</link>
              <description>Body of first post</description>
              <author>alice</author>
              <pubDate>Thu, 25 Jun 2026 10:00:00 GMT</pubDate>
              <guid>https://example.com/1</guid>
            </item>
            <item>
              <title>Second post</title>
              <link>https://example.com/2</link>
              <description><![CDATA[<p>CDATA body</p>]]></description>
              <pubDate>Thu, 25 Jun 2026 11:00:00 GMT</pubDate>
              <guid>guid-2</guid>
            </item>
          </channel>
        </rss>`;
      const entries = parseRssFeed(xml);
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe("First post");
      expect(entries[0].content).toBe("Body of first post");
      expect(entries[0].link).toBe("https://example.com/1");
      expect(entries[0].author).toBe("alice");
      expect(entries[0].pubDate?.toISOString()).toBe("2026-06-25T10:00:00.000Z");
      expect(entries[1].content).toBe("CDATA body");
    });

    it("parses Atom 1.0 entries", () => {
      const xml = `<?xml version="1.0"?>
        <feed xmlns="http://www.w3.org/2005/Atom">
          <entry>
            <title>Atom entry</title>
            <link href="https://example.com/a"/>
            <id>atom-id-1</id>
            <author><name>bob</name></author>
            <published>2026-06-25T12:00:00Z</published>
            <content>Atom content</content>
          </entry>
        </feed>`;
      const entries = parseRssFeed(xml);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Atom entry");
      expect(entries[0].link).toBe("https://example.com/a");
      expect(entries[0].author).toBe("bob");
      expect(entries[0].content).toBe("Atom content");
      expect(entries[0].guid).toBe("atom-id-1");
    });

    it("returns empty array for malformed XML", () => {
      expect(parseRssFeed("not xml")).toEqual([]);
      expect(parseRssFeed("")).toEqual([]);
    });

    it("handles missing fields gracefully", () => {
      const xml = `<rss><channel><item><title>Only title</title></item></channel></rss>`;
      const entries = parseRssFeed(xml);
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe("Only title");
      expect(entries[0].content).toBe("");
      expect(entries[0].link).toBe("");
      expect(entries[0].author).toBeNull();
    });
  });
});

describe("CSV adapter", () => {
  describe("parseCsvUpload", () => {
    it("parses valid CSV rows", () => {
      const csv = "title,content,author,url,timestamp\n" +
        "Bug report,App crashes on iOS,user1,https://example.com/1,2026-06-25T10:00:00Z\n" +
        "Feature request,Add dark mode,user2,https://example.com/2,2026-06-25T11:00:00Z";
      const { items, errors } = parseCsvUpload(csv);
      expect(errors).toHaveLength(0);
      expect(items).toHaveLength(2);
      expect(items[0].title).toBe("Bug report");
      expect(items[0].rawContent).toBe("App crashes on iOS");
      expect(items[0].authorLogin).toBe("user1");
      expect(items[0].url).toBe("https://example.com/1");
      expect(items[0].source).toBe("CSVUpload");
      expect(items[0].externalId).toContain("csv:");
    });

    it("defaults timestamp to now when missing", () => {
      const csv = "title,content\nHello,World";
      const { items } = parseCsvUpload(csv);
      expect(items).toHaveLength(1);
      expect(items[0].originalTimestamp).toBeInstanceOf(Date);
    });

    it("reports errors for rows missing content", () => {
      const csv = "title,content\nHas title,\n,Has content";
      const { items, errors } = parseCsvUpload(csv);
      expect(items).toHaveLength(1);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain("content");
    });

    it("reports errors for invalid timestamps", () => {
      const csv = "title,content,timestamp\nA,B,not-a-date";
      const { items, errors } = parseCsvUpload(csv);
      expect(items).toHaveLength(0);
      expect(errors).toHaveLength(1);
      expect(errors[0].error).toContain("Invalid timestamp");
    });

    it("handles custom source label", () => {
      const csv = "content\nHello";
      const { items } = parseCsvUpload(csv, "CustomUpload");
      expect(items[0].source).toBe("CustomUpload");
    });
  });
});
