import { describe, it, expect } from "vitest";

// Test the pure rendering function that doesn't require database access.
import { renderDigestHtml } from "@/lib/digest";
import type { DigestSummary } from "@/lib/digest";

const sampleSummary: DigestSummary = {
  totalItems: 42,
  byStatus: [
    { status: "NEW", count: 20 },
    { status: "ACKNOWLEDGED", count: 15 },
    { status: "ACTIONED", count: 7 },
  ],
  bySentiment: [
    { sentiment: "positive", count: 10 },
    { sentiment: "neutral", count: 15 },
    { sentiment: "negative", count: 17 },
  ],
  highSeverity: [
    {
      title: "App crashes on startup",
      externalId: "vercel/next.js#12345",
      severityScore: 5,
      sentiment: "negative",
      summary: "App crashes on iOS 17.",
      status: "NEW",
      url: "https://github.com/vercel/next.js/issues/12345",
    },
  ],
  recentNew: [
    {
      title: "Slow page load",
      externalId: "vercel/next.js#12346",
      sentiment: "negative",
      summary: "Pages take 10s to load.",
      url: "https://github.com/vercel/next.js/issues/12346",
    },
  ],
};

describe("Digest module", () => {
  describe("renderDigestHtml", () => {
    it("renders a complete HTML document", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<html>");
      expect(html).toContain("</html>");
    });

    it("includes the total item count", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("42");
      expect(html).toContain("total feedback items");
    });

    it("includes status breakdown table with all statuses", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("Status Breakdown");
      expect(html).toContain("NEW");
      expect(html).toContain("ACKNOWLEDGED");
      expect(html).toContain("ACTIONED");
      expect(html).toContain(">20<");
      expect(html).toContain(">15<");
      expect(html).toContain(">7<");
    });

    it("includes sentiment distribution table", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("Sentiment Distribution");
      expect(html).toContain("positive");
      expect(html).toContain("neutral");
      expect(html).toContain("negative");
    });

    it("includes high-severity items section when items exist", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("High-Severity");
      expect(html).toContain("App crashes on startup");
      expect(html).toContain("5/5");
    });

    it("shows no-high-severity message when list is empty", () => {
      const emptySummary: DigestSummary = {
        ...sampleSummary,
        highSeverity: [],
      };
      const html = renderDigestHtml(emptySummary);
      expect(html).toContain("No high-severity items pending action");
    });

    it("includes recent new feedback section when items exist", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain("Recent New Feedback");
      expect(html).toContain("Slow page load");
    });

    it("shows no-recent-feedback message when list is empty", () => {
      const emptySummary: DigestSummary = {
        ...sampleSummary,
        recentNew: [],
      };
      const html = renderDigestHtml(emptySummary);
      expect(html).toContain("No new feedback in the last 24 hours");
    });

    it("includes links to feedback items when URL is present", () => {
      const html = renderDigestHtml(sampleSummary);
      expect(html).toContain('href="https://github.com/vercel/next.js/issues/12345"');
    });
  });
});
