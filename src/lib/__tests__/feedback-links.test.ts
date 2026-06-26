import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with mock models we control from each test.
const { mockFeedbackLink, mockFeedbackItem } = vi.hoisted(() => ({
  mockFeedbackLink: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  mockFeedbackItem: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    feedbackLink: mockFeedbackLink,
    feedbackItem: mockFeedbackItem,
  },
}));

import {
  createLink,
  removeLink,
  getLinks,
  getDuplicateSuggestions,
  RELATION_TYPES,
} from "@/lib/feedback-links";

beforeEach(() => {
  mockFeedbackLink.create.mockReset();
  mockFeedbackLink.deleteMany.mockReset();
  mockFeedbackLink.findMany.mockReset();
  mockFeedbackItem.findUnique.mockReset();
  mockFeedbackItem.findMany.mockReset();
});

describe("feedback-links service", () => {
  describe("RELATION_TYPES", () => {
    it("exports the expected relation types", () => {
      expect(RELATION_TYPES).toEqual([
        "duplicate",
        "related",
        "blocks",
        "blocked_by",
      ]);
    });
  });

  describe("createLink", () => {
    it("creates a link with valid inputs and returns serialized fields", async () => {
      const createdAt = new Date("2024-06-01T10:00:00.000Z");
      mockFeedbackLink.create.mockResolvedValue({
        id: "link-1",
        fromItemId: "fi-1",
        toItemId: "fi-2",
        relationType: "duplicate",
        createdById: "u-1",
        createdAt,
      });

      const link = await createLink("fi-1", "fi-2", "duplicate", "u-1");

      expect(mockFeedbackLink.create).toHaveBeenCalledWith({
        data: {
          fromItemId: "fi-1",
          toItemId: "fi-2",
          relationType: "duplicate",
          createdById: "u-1",
        },
      });
      expect(link).toEqual({
        id: "link-1",
        fromItemId: "fi-1",
        toItemId: "fi-2",
        relationType: "duplicate",
        createdById: "u-1",
        createdAt: createdAt.toISOString(),
      });
    });

    it("prevents self-linking", async () => {
      await expect(
        createLink("fi-1", "fi-1", "related", "u-1")
      ).rejects.toThrow(/itself/i);
      expect(mockFeedbackLink.create).not.toHaveBeenCalled();
    });

    it("rejects an invalid relation type", async () => {
      await expect(
        createLink("fi-1", "fi-2", "bogus", "u-1")
      ).rejects.toThrow(/invalid relation type/i);
      expect(mockFeedbackLink.create).not.toHaveBeenCalled();
    });

    it("accepts all exported relation types", async () => {
      const createdAt = new Date("2024-06-01T10:00:00.000Z");
      for (const rt of RELATION_TYPES) {
        mockFeedbackLink.create.mockResolvedValueOnce({
          id: `link-${rt}`,
          fromItemId: "fi-1",
          toItemId: "fi-2",
          relationType: rt,
          createdById: "u-1",
          createdAt,
        });
        const link = await createLink("fi-1", "fi-2", rt, "u-1");
        expect(link.relationType).toBe(rt);
      }
    });
  });

  describe("removeLink", () => {
    it("returns true when a row is deleted", async () => {
      mockFeedbackLink.deleteMany.mockResolvedValue({ count: 1 });
      const ok = await removeLink("link-1", "u-1");
      expect(mockFeedbackLink.deleteMany).toHaveBeenCalledWith({
        where: { id: "link-1" },
      });
      expect(ok).toBe(true);
    });

    it("returns false when no row is deleted", async () => {
      mockFeedbackLink.deleteMany.mockResolvedValue({ count: 0 });
      const ok = await removeLink("link-missing", "u-1");
      expect(ok).toBe(false);
    });
  });

  describe("getLinks", () => {
    it("queries both directions and includes related item details", async () => {
      const createdFrom = new Date("2024-06-02T00:00:00.000Z");
      const createdTo = new Date("2024-06-03T00:00:00.000Z");
      // linksFrom query
      mockFeedbackLink.findMany
        .mockResolvedValueOnce([
          {
            id: "l1",
            fromItemId: "fi-1",
            toItemId: "fi-2",
            relationType: "duplicate",
            createdById: "u-1",
            createdAt: createdFrom,
            toItem: { id: "fi-2", title: "Bug A", source: "GitHubIssues" },
          },
        ])
        // linksTo query
        .mockResolvedValueOnce([
          {
            id: "l2",
            fromItemId: "fi-3",
            toItemId: "fi-1",
            relationType: "blocks",
            createdById: "u-2",
            createdAt: createdTo,
            fromItem: { id: "fi-3", title: "Bug B", source: "Trustpilot" },
          },
        ]);

      const result = await getLinks("fi-1");

      expect(mockFeedbackLink.findMany).toHaveBeenCalledTimes(2);
      expect(mockFeedbackLink.findMany).toHaveBeenNthCalledWith(1, {
        where: { fromItemId: "fi-1" },
        include: {
          toItem: { select: { id: true, title: true, source: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(mockFeedbackLink.findMany).toHaveBeenNthCalledWith(2, {
        where: { toItemId: "fi-1" },
        include: {
          fromItem: { select: { id: true, title: true, source: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      expect(result.linksFrom).toEqual([
        {
          id: "l1",
          fromItemId: "fi-1",
          toItemId: "fi-2",
          relationType: "duplicate",
          createdById: "u-1",
          createdAt: createdFrom.toISOString(),
          item: { id: "fi-2", title: "Bug A", source: "GitHubIssues" },
          direction: "from",
        },
      ]);
      expect(result.linksTo).toEqual([
        {
          id: "l2",
          fromItemId: "fi-3",
          toItemId: "fi-1",
          relationType: "blocks",
          createdById: "u-2",
          createdAt: createdTo.toISOString(),
          item: { id: "fi-3", title: "Bug B", source: "Trustpilot" },
          direction: "to",
        },
      ]);
    });

    it("returns empty arrays when there are no links", async () => {
      mockFeedbackLink.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      const result = await getLinks("fi-1");
      expect(result.linksFrom).toEqual([]);
      expect(result.linksTo).toEqual([]);
    });
  });

  describe("getDuplicateSuggestions", () => {
    it("returns same-source items with similar titles (substring match), limited to 5", async () => {
      mockFeedbackItem.findUnique.mockResolvedValueOnce({
        id: "fi-1",
        source: "GitHubIssues",
        title: "Login button broken",
      });
      mockFeedbackItem.findMany.mockResolvedValueOnce([
        { id: "fi-2", title: "Login button broken on safari", source: "GitHubIssues" }, // match (contains)
        { id: "fi-3", title: "Login button broken", source: "GitHubIssues" }, // match (equal)
        { id: "fi-4", title: "Login", source: "GitHubIssues" }, // match (title contains ct)
        { id: "fi-5", title: "Logout button broken", source: "GitHubIssues" }, // no match
        { id: "fi-7", title: "Completely unrelated", source: "GitHubIssues" }, // no match
        { id: "fi-8", title: "Login button broken on firefox", source: "GitHubIssues" }, // match
        { id: "fi-9", title: "Login button broken on chrome", source: "GitHubIssues" }, // match
        { id: "fi-10", title: "Login button broken on edge", source: "GitHubIssues" }, // match (would be 6th -> cut)
      ]);

      const suggestions = await getDuplicateSuggestions("fi-1");

      expect(mockFeedbackItem.findUnique).toHaveBeenCalledWith({
        where: { id: "fi-1" },
        select: { id: true, source: true, title: true },
      });
      expect(mockFeedbackItem.findMany).toHaveBeenCalledWith({
        where: {
          source: "GitHubIssues",
          id: { not: "fi-1" },
          title: { not: null },
        },
        select: { id: true, title: true, source: true },
        take: 500,
      });

      // Only matching items, limited to 5.
      expect(suggestions).toHaveLength(5);
      const ids = suggestions.map((s) => s.id);
      expect(ids).not.toContain("fi-5");
      expect(ids).not.toContain("fi-7");
      expect(ids).not.toContain("fi-10"); // 6th match, cut by limit
      // Each suggestion carries item summary fields.
      for (const s of suggestions) {
        expect(s).toHaveProperty("id");
        expect(s).toHaveProperty("title");
        expect(s).toHaveProperty("source", "GitHubIssues");
      }
    });

    it("returns an empty array when the item has no title", async () => {
      mockFeedbackItem.findUnique.mockResolvedValueOnce({
        id: "fi-1",
        source: "GitHubIssues",
        title: null,
      });
      const suggestions = await getDuplicateSuggestions("fi-1");
      expect(suggestions).toEqual([]);
      expect(mockFeedbackItem.findMany).not.toHaveBeenCalled();
    });

    it("returns an empty array when the item does not exist", async () => {
      mockFeedbackItem.findUnique.mockResolvedValueOnce(null);
      const suggestions = await getDuplicateSuggestions("fi-missing");
      expect(suggestions).toEqual([]);
      expect(mockFeedbackItem.findMany).not.toHaveBeenCalled();
    });

    it("performs case-insensitive matching", async () => {
      mockFeedbackItem.findUnique.mockResolvedValueOnce({
        id: "fi-1",
        source: "GitHubIssues",
        title: "LOGIN BUTTON BROKEN",
      });
      mockFeedbackItem.findMany.mockResolvedValueOnce([
        { id: "fi-2", title: "login button broken on safari", source: "GitHubIssues" },
      ]);
      const suggestions = await getDuplicateSuggestions("fi-1");
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].id).toBe("fi-2");
    });
  });
});
