import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma with a mock replyTemplate model we control from each test.
// vi.hoisted ensures the mock object exists before the hoisted vi.mock call.
const { mockTemplate } = vi.hoisted(() => ({
  mockTemplate: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    replyTemplate: mockTemplate,
  },
}));

import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  searchTemplates,
  applyTemplate,
  toTemplateDto,
} from "@/lib/reply-templates";

const row = {
  id: "t1",
  name: "Welcome",
  subject: "Re: your feedback",
  body: "Hi {{customerName}}, thanks for {{itemTitle}}.",
  tags: ["greeting", "welcome"],
  userId: "u1",
  createdAt: new Date("2024-01-01T00:00:00.000Z"),
  updatedAt: new Date("2024-01-02T00:00:00.000Z"),
};

beforeEach(() => {
  mockTemplate.findMany.mockReset();
  mockTemplate.findUnique.mockReset();
  mockTemplate.create.mockReset();
  mockTemplate.update.mockReset();
  mockTemplate.delete.mockReset();
});

describe("reply-templates service", () => {
  describe("toTemplateDto", () => {
    it("maps a prisma row to a JSON-safe DTO with normalized tags and ISO dates", () => {
      const dto = toTemplateDto(row);
      expect(dto).toEqual({
        id: "t1",
        name: "Welcome",
        subject: "Re: your feedback",
        body: "Hi {{customerName}}, thanks for {{itemTitle}}.",
        tags: ["greeting", "welcome"],
        userId: "u1",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-02T00:00:00.000Z",
      });
    });

    it("coerces non-array tags to an empty array and drops non-string entries", () => {
      const dto = toTemplateDto({ ...row, tags: [1, "ok", null, "x"] });
      expect(dto.tags).toEqual(["ok", "x"]);
      const dto2 = toTemplateDto({ ...row, tags: "nope" });
      expect(dto2.tags).toEqual([]);
    });
  });

  describe("listTemplates", () => {
    it("returns templates owned by the user, newest first", async () => {
      mockTemplate.findMany.mockResolvedValue([row]);
      const templates = await listTemplates("u1");
      expect(mockTemplate.findMany).toHaveBeenCalledWith({
        where: { userId: "u1" },
        orderBy: { createdAt: "desc" },
      });
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("t1");
    });

    it("returns an empty array when no templates exist", async () => {
      mockTemplate.findMany.mockResolvedValue([]);
      const templates = await listTemplates("u1");
      expect(templates).toEqual([]);
    });
  });

  describe("createTemplate", () => {
    it("calls prisma.replyTemplate.create with userId and defaults", async () => {
      mockTemplate.create.mockResolvedValue(row);
      const template = await createTemplate("u1", {
        name: "Welcome",
        body: "Hi there",
      });
      expect(mockTemplate.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          name: "Welcome",
          subject: null,
          body: "Hi there",
          tags: [],
        },
      });
      expect(template.id).toBe("t1");
    });

    it("passes through subject and tags when provided", async () => {
      mockTemplate.create.mockResolvedValue(row);
      await createTemplate("u1", {
        name: "Welcome",
        subject: "Re: feedback",
        body: "Hi there",
        tags: ["a", "b"],
      });
      expect(mockTemplate.create).toHaveBeenCalledWith({
        data: {
          userId: "u1",
          name: "Welcome",
          subject: "Re: feedback",
          body: "Hi there",
          tags: ["a", "b"],
        },
      });
    });
  });

  describe("updateTemplate", () => {
    it("updates the template when ownership matches", async () => {
      mockTemplate.findUnique.mockResolvedValue(row);
      mockTemplate.update.mockResolvedValue({ ...row, name: "Renamed" });
      const template = await updateTemplate("t1", "u1", { name: "Renamed" });
      expect(mockTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: "t1" },
      });
      expect(mockTemplate.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "Renamed" },
      });
      expect(template.name).toBe("Renamed");
    });

    it("throws when the template does not exist", async () => {
      mockTemplate.findUnique.mockResolvedValue(null);
      await expect(updateTemplate("t1", "u1", { name: "X" })).rejects.toThrow(
        /not found or not owned/
      );
      expect(mockTemplate.update).not.toHaveBeenCalled();
    });

    it("throws when the template is owned by another user", async () => {
      mockTemplate.findUnique.mockResolvedValue({ ...row, userId: "u2" });
      await expect(updateTemplate("t1", "u1", { name: "X" })).rejects.toThrow(
        /not found or not owned/
      );
      expect(mockTemplate.update).not.toHaveBeenCalled();
    });

    it("only sends provided fields to prisma.update", async () => {
      mockTemplate.findUnique.mockResolvedValue(row);
      mockTemplate.update.mockResolvedValue(row);
      await updateTemplate("t1", "u1", { body: "new body", tags: ["x"] });
      expect(mockTemplate.update).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { body: "new body", tags: ["x"] },
      });
    });
  });

  describe("deleteTemplate", () => {
    it("deletes the template when ownership matches", async () => {
      mockTemplate.findUnique.mockResolvedValue(row);
      mockTemplate.delete.mockResolvedValue(row);
      await deleteTemplate("t1", "u1");
      expect(mockTemplate.delete).toHaveBeenCalledWith({
        where: { id: "t1" },
      });
    });

    it("throws when the template is not owned by the caller", async () => {
      mockTemplate.findUnique.mockResolvedValue({ ...row, userId: "u2" });
      await expect(deleteTemplate("t1", "u1")).rejects.toThrow(
        /not found or not owned/
      );
      expect(mockTemplate.delete).not.toHaveBeenCalled();
    });

    it("throws when the template does not exist", async () => {
      mockTemplate.findUnique.mockResolvedValue(null);
      await expect(deleteTemplate("t1", "u1")).rejects.toThrow(
        /not found or not owned/
      );
      expect(mockTemplate.delete).not.toHaveBeenCalled();
    });
  });

  describe("searchTemplates", () => {
    it("returns all templates via listTemplates when query is blank", async () => {
      mockTemplate.findMany.mockResolvedValue([row]);
      const templates = await searchTemplates("u1", "   ");
      // Blank query short-circuits to listTemplates (single findMany call).
      expect(mockTemplate.findMany).toHaveBeenCalledTimes(1);
      expect(templates).toHaveLength(1);
    });

    it("matches templates by name substring (case-insensitive)", async () => {
      // First call: the OR(name/body) query returns the match.
      mockTemplate.findMany
        .mockResolvedValueOnce([row]) // name/body candidate query
        .mockResolvedValueOnce([]); // tag-scan query returns nothing extra
      const templates = await searchTemplates("u1", "welcome");
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("t1");
    });

    it("matches templates by body substring", async () => {
      mockTemplate.findMany
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([]);
      const templates = await searchTemplates("u1", "customerName");
      expect(templates).toHaveLength(1);
    });

    it("matches templates by tag substring (via the tag-scan query)", async () => {
      // name/body query returns nothing, but the tag-scan finds the row.
      mockTemplate.findMany
        .mockResolvedValueOnce([]) // name/body candidate query
        .mockResolvedValueOnce([row]); // tag-scan query
      const templates = await searchTemplates("u1", "greet");
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe("t1");
    });

    it("dedupes rows that match both name/body and tags", async () => {
      mockTemplate.findMany
        .mockResolvedValueOnce([row])
        .mockResolvedValueOnce([row]);
      const templates = await searchTemplates("u1", "welcome");
      expect(templates).toHaveLength(1);
    });
  });

  describe("applyTemplate", () => {
    it("replaces all known placeholders with context values", () => {
      const result = applyTemplate(
        {
          body:
            "Hi {{customerName}}, about {{itemTitle}}: {{itemSummary}}. Thanks, {{customerName}}!",
        },
        {
          customerName: "Alice",
          itemTitle: "Bug #42",
          itemSummary: "We fixed the crash",
        }
      );
      expect(result).toBe(
        "Hi Alice, about Bug #42: We fixed the crash. Thanks, Alice!"
      );
    });

    it("accepts a raw body string as the template", () => {
      const result = applyTemplate("Hello {{customerName}}", {
        customerName: "Bob",
      });
      expect(result).toBe("Hello Bob");
    });

    it("replaces missing context values with an empty string", () => {
      const result = applyTemplate(
        "Hi {{customerName}}, re: {{itemTitle}} — {{itemSummary}}.",
        {}
      );
      expect(result).toBe("Hi , re:  — .");
    });

    it("returns the body unchanged when there are no placeholders", () => {
      const result = applyTemplate(
        { body: "Thanks for reaching out." },
        { customerName: "Alice" }
      );
      expect(result).toBe("Thanks for reaching out.");
    });

    it("replaces multiple occurrences of the same placeholder", () => {
      const result = applyTemplate("{{itemTitle}} and {{itemTitle}}", {
        itemTitle: "X",
      });
      expect(result).toBe("X and X");
    });
  });
});
