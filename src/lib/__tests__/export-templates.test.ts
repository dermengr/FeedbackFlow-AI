import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the export-templates service can be tested without a
// database. The mock functions are created via vi.hoisted so they are
// available inside the hoisted vi.mock factory.
const {
  mockFindMany,
  mockCreate,
  mockFindUnique,
  mockUpdate,
  mockDelete,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    exportTemplate: {
      findMany: mockFindMany,
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
  },
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockCreate.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  DEFAULT_COLUMNS,
  AVAILABLE_FIELDS,
} from "@/lib/export-templates";

describe("export-templates service", () => {
  describe("DEFAULT_COLUMNS", () => {
    it("contains the expected eight default columns", () => {
      expect(DEFAULT_COLUMNS).toEqual([
        { field: "title", label: "Title" },
        { field: "source", label: "Source" },
        { field: "sentiment", label: "Sentiment" },
        { field: "severityScore", label: "Severity" },
        { field: "summary", label: "Summary" },
        { field: "status", label: "Status" },
        { field: "topics", label: "Topics" },
        { field: "createdAt", label: "Created" },
      ]);
    });

    it("every default column has a string field and label", () => {
      for (const col of DEFAULT_COLUMNS) {
        expect(typeof col.field).toBe("string");
        expect(typeof col.label).toBe("string");
      }
    });
  });

  describe("AVAILABLE_FIELDS", () => {
    it("is a superset of DEFAULT_COLUMNS", () => {
      for (const col of DEFAULT_COLUMNS) {
        expect(AVAILABLE_FIELDS).toContainEqual(col);
      }
    });

    it("includes additional selectable fields beyond the defaults", () => {
      const fields = AVAILABLE_FIELDS.map((c) => c.field);
      expect(fields).toContain("externalId");
      expect(fields).toContain("author");
      expect(fields).toContain("language");
      expect(fields).toContain("emotion");
      expect(fields).toContain("url");
      expect(fields).toContain("rawContent");
    });
  });

  describe("listTemplates", () => {
    it("filters by userId and orders by createdAt desc", async () => {
      const date1 = new Date("2026-01-01T00:00:00Z");
      const date2 = new Date("2026-02-01T00:00:00Z");
      mockFindMany.mockResolvedValue([
        {
          id: "t2",
          name: "Bugs CSV",
          columns: [{ field: "title", label: "Title" }],
          format: "csv",
          filterQuery: "topic=Bug",
          userId: "user-1",
          createdAt: date2,
        },
        {
          id: "t1",
          name: "Neg JSON",
          columns: [{ field: "summary", label: "Summary" }],
          format: "json",
          filterQuery: "sentiment=negative",
          userId: "user-1",
          createdAt: date1,
        },
      ]);

      const result = await listTemplates("user-1");

      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(2);
      // newest first
      expect(result[0].id).toBe("t2");
      expect(result[1].id).toBe("t1");
    });

    it("returns all templates when no userId is provided", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "t3",
          name: "Shared",
          columns: DEFAULT_COLUMNS,
          format: "csv",
          filterQuery: null,
          userId: null,
          createdAt: new Date(),
        },
      ]);

      const result = await listTemplates();

      expect(mockFindMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
    });

    it("converts createdAt Date to ISO string in DTOs", async () => {
      const date = new Date("2026-03-15T12:30:00Z");
      mockFindMany.mockResolvedValue([
        {
          id: "t9",
          name: "X",
          columns: [],
          format: "csv",
          filterQuery: null,
          userId: "u",
          createdAt: date,
        },
      ]);

      const result = await listTemplates("u");
      expect(result[0].createdAt).toBe(date.toISOString());
      expect(typeof result[0].createdAt).toBe("string");
    });

    it("returns empty array when no templates exist", async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await listTemplates("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("createTemplate", () => {
    it("calls prisma.exportTemplate.create with the provided data", async () => {
      const date = new Date("2026-04-01T00:00:00Z");
      mockCreate.mockResolvedValue({
        id: "new-1",
        name: "My Template",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: "sentiment=negative",
        userId: "user-1",
        createdAt: date,
      });

      const result = await createTemplate("user-1", {
        name: "My Template",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: "sentiment=negative",
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "My Template",
          columns: DEFAULT_COLUMNS,
          format: "csv",
          filterQuery: "sentiment=negative",
        },
      });
      expect(result).toEqual({
        id: "new-1",
        name: "My Template",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: "sentiment=negative",
        userId: "user-1",
        createdAt: date.toISOString(),
      });
    });

    it("defaults format to csv and filterQuery to null when omitted", async () => {
      mockCreate.mockResolvedValue({
        id: "new-2",
        name: "Defaults",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });

      await createTemplate("user-1", {
        name: "Defaults",
        columns: DEFAULT_COLUMNS,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          name: "Defaults",
          columns: DEFAULT_COLUMNS,
          format: "csv",
          filterQuery: null,
        },
      });
    });

    it("stores the filterQuery string verbatim", async () => {
      const filter = "sentiment=negative&topic=Bug&status=open";
      mockCreate.mockResolvedValue({
        id: "new-3",
        name: "F",
        columns: DEFAULT_COLUMNS,
        format: "tsv",
        filterQuery: filter,
        userId: "u",
        createdAt: new Date(),
      });

      const result = await createTemplate("u", {
        name: "F",
        columns: DEFAULT_COLUMNS,
        format: "tsv",
        filterQuery: filter,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({ filterQuery: filter }),
      });
      expect(result.filterQuery).toBe(filter);
    });

    it("converts createdAt Date to ISO string", async () => {
      const date = new Date("2026-05-20T08:00:00Z");
      mockCreate.mockResolvedValue({
        id: "x",
        name: "n",
        columns: [],
        format: "csv",
        filterQuery: null,
        userId: "u",
        createdAt: date,
      });
      const result = await createTemplate("u", { name: "n", columns: [] });
      expect(result.createdAt).toBe(date.toISOString());
    });
  });

  describe("updateTemplate", () => {
    it("verifies ownership before updating", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "Old",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });
      mockUpdate.mockResolvedValue({
        id: "t1",
        name: "New",
        columns: DEFAULT_COLUMNS,
        format: "json",
        filterQuery: "topic=Bug",
        userId: "user-1",
        createdAt: new Date(),
      });

      const result = await updateTemplate("t1", "user-1", {
        name: "New",
        format: "json",
        filterQuery: "topic=Bug",
      });

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "New", format: "json", filterQuery: "topic=Bug" },
      });
      expect(result.name).toBe("New");
      expect(result.format).toBe("json");
    });

    it("only sends provided fields to prisma.update", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "Old",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });
      mockUpdate.mockResolvedValue({
        id: "t1",
        name: "Renamed",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });

      await updateTemplate("t1", "user-1", { name: "Renamed" });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { name: "Renamed" },
      });
    });

    it("throws if the template does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(
        updateTemplate("missing", "user-1", { name: "X" })
      ).rejects.toThrow(/not found/i);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws if the template is owned by a different user", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "Old",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-2",
        createdAt: new Date(),
      });
      await expect(
        updateTemplate("t1", "user-1", { name: "X" })
      ).rejects.toThrow(/not found/i);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("can clear filterQuery by passing null", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "Old",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: "topic=Bug",
        userId: "user-1",
        createdAt: new Date(),
      });
      mockUpdate.mockResolvedValue({
        id: "t1",
        name: "Old",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });

      const result = await updateTemplate("t1", "user-1", {
        filterQuery: null,
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "t1" },
        data: { filterQuery: null },
      });
      expect(result.filterQuery).toBeNull();
    });
  });

  describe("deleteTemplate", () => {
    it("verifies ownership before deleting", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "X",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-1",
        createdAt: new Date(),
      });
      mockDelete.mockResolvedValue(undefined);

      await deleteTemplate("t1", "user-1");

      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "t1" } });
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "t1" } });
    });

    it("throws if the template does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(deleteTemplate("missing", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("throws if the template is owned by a different user", async () => {
      mockFindUnique.mockResolvedValue({
        id: "t1",
        name: "X",
        columns: DEFAULT_COLUMNS,
        format: "csv",
        filterQuery: null,
        userId: "user-2",
        createdAt: new Date(),
      });
      await expect(deleteTemplate("t1", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("template validation / normalization", () => {
    it("coerces malformed stored columns into an empty array", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "bad",
          name: "Bad",
          columns: "not-an-array",
          format: "csv",
          filterQuery: null,
          userId: "u",
          createdAt: new Date(),
        },
      ]);

      const result = await listTemplates("u");
      expect(result[0].columns).toEqual([]);
    });

    it("filters out malformed column entries", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "mixed",
          name: "Mixed",
          columns: [
            { field: "title", label: "Title" },
            { field: 123, label: "Nope" },
            { label: "Missing field" },
            null,
            "string-entry",
          ],
          format: "csv",
          filterQuery: null,
          userId: "u",
          createdAt: new Date(),
        },
      ]);

      const result = await listTemplates("u");
      expect(result[0].columns).toEqual([{ field: "title", label: "Title" }]);
    });

    it("falls back to csv format when an unknown format is stored", async () => {
      mockFindMany.mockResolvedValue([
        {
          id: "weird",
          name: "Weird",
          columns: [],
          format: "xml",
          filterQuery: null,
          userId: "u",
          createdAt: new Date(),
        },
      ]);

      const result = await listTemplates("u");
      expect(result[0].format).toBe("csv");
    });
  });
});
