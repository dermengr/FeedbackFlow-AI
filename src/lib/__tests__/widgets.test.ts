import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma so the widgets service can be tested without a database. The
// mock functions are created via vi.hoisted so they are available inside the
// hoisted vi.mock factory.
const {
  mockFindMany,
  mockCreate,
  mockFindUnique,
  mockUpdate,
  mockDelete,
  mockAnalysisGroupBy,
  mockAnalysisFindMany,
  mockItemFindMany,
} = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockAnalysisGroupBy: vi.fn(),
  mockAnalysisFindMany: vi.fn(),
  mockItemFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardWidget: {
      findMany: mockFindMany,
      create: mockCreate,
      findUnique: mockFindUnique,
      update: mockUpdate,
      delete: mockDelete,
    },
    feedbackAnalysis: {
      groupBy: mockAnalysisGroupBy,
      findMany: mockAnalysisFindMany,
    },
    feedbackItem: {
      findMany: mockItemFindMany,
    },
  },
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockCreate.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockAnalysisGroupBy.mockReset();
  mockAnalysisFindMany.mockReset();
  mockItemFindMany.mockReset();
});

import {
  listWidgets,
  createWidget,
  updateWidget,
  deleteWidget,
  getWidgetData,
  toWidgetDto,
  WIDGET_TYPES,
  isWidgetType,
} from "@/lib/widgets";

const baseRow = {
  id: "w1",
  userId: "user-1",
  type: "sentiment_summary",
  title: "Sentiment",
  config: {},
  positionX: 0,
  positionY: 0,
  width: 1,
  height: 1,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
};

describe("widgets service", () => {
  describe("WIDGET_TYPES / isWidgetType", () => {
    it("exports the expected set of widget types", () => {
      expect(WIDGET_TYPES).toEqual([
        "sentiment_summary",
        "severity_distribution",
        "recent_items",
        "topic_breakdown",
        "trend_sparkline",
      ]);
    });

    it("isWidgetType validates membership", () => {
      expect(isWidgetType("sentiment_summary")).toBe(true);
      expect(isWidgetType("unknown")).toBe(false);
    });
  });

  describe("toWidgetDto", () => {
    it("serializes Date fields to ISO strings", () => {
      const dto = toWidgetDto(baseRow);
      expect(dto.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(dto.updatedAt).toBe("2026-01-02T00:00:00.000Z");
      expect(dto.id).toBe("w1");
    });
  });

  describe("listWidgets", () => {
    it("filters by userId and orders by grid position", async () => {
      mockFindMany.mockResolvedValue([baseRow]);
      const result = await listWidgets("user-1");
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("w1");
      expect(typeof result[0].createdAt).toBe("string");
    });

    it("returns empty array when no widgets exist", async () => {
      mockFindMany.mockResolvedValue([]);
      const result = await listWidgets("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("createWidget", () => {
    it("creates a widget with defaults for omitted position fields", async () => {
      mockCreate.mockResolvedValue(baseRow);
      await createWidget("user-1", {
        type: "sentiment_summary",
        title: "Sentiment",
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "sentiment_summary",
          title: "Sentiment",
          config: {},
          positionX: 0,
          positionY: 0,
          width: 1,
          height: 1,
        },
      });
    });

    it("passes through provided position/size values", async () => {
      mockCreate.mockResolvedValue({ ...baseRow, positionX: 2, positionY: 3, width: 4, height: 2 });
      await createWidget("user-1", {
        type: "recent_items",
        title: "Recent",
        positionX: 2,
        positionY: 3,
        width: 4,
        height: 2,
        config: { limit: 5 },
      });
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          userId: "user-1",
          type: "recent_items",
          title: "Recent",
          config: { limit: 5 },
          positionX: 2,
          positionY: 3,
          width: 4,
          height: 2,
        },
      });
    });

    it("clamps negative positions to zero", async () => {
      mockCreate.mockResolvedValue(baseRow);
      await createWidget("user-1", {
        type: "sentiment_summary",
        title: "X",
        positionX: -5,
        positionY: -2,
        width: -1,
        height: -3,
      });
      const data = mockCreate.mock.calls[0][0].data;
      expect(data.positionX).toBe(0);
      expect(data.positionY).toBe(0);
      expect(data.width).toBe(1);
      expect(data.height).toBe(1);
    });

    it("throws for an unsupported widget type", async () => {
      await expect(
        createWidget("user-1", { type: "bogus", title: "X" })
      ).rejects.toThrow(/Unsupported widget type/);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("updateWidget", () => {
    it("updates only the provided fields after verifying ownership", async () => {
      mockFindUnique.mockResolvedValue(baseRow);
      mockUpdate.mockResolvedValue({ ...baseRow, positionX: 4, positionY: 1 });
      const result = await updateWidget("w1", "user-1", {
        positionX: 4,
        positionY: 1,
      });
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "w1" } });
      expect(mockUpdate).toHaveBeenCalledWith({
        where: { id: "w1" },
        data: { positionX: 4, positionY: 1 },
      });
      expect(result.positionX).toBe(4);
    });

    it("throws if the widget does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(
        updateWidget("missing", "user-1", { title: "X" })
      ).rejects.toThrow();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("throws if the widget is owned by a different user", async () => {
      mockFindUnique.mockResolvedValue({ ...baseRow, userId: "user-2" });
      await expect(
        updateWidget("w1", "user-1", { title: "X" })
      ).rejects.toThrow();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("clamps negative positions in updates", async () => {
      mockFindUnique.mockResolvedValue(baseRow);
      mockUpdate.mockResolvedValue(baseRow);
      await updateWidget("w1", "user-1", { positionX: -3, width: -2 });
      const data = mockUpdate.mock.calls[0][0].data;
      expect(data.positionX).toBe(0);
      expect(data.width).toBe(1);
    });
  });

  describe("deleteWidget", () => {
    it("verifies ownership before deleting", async () => {
      mockFindUnique.mockResolvedValue(baseRow);
      mockDelete.mockResolvedValue(undefined);
      await deleteWidget("w1", "user-1");
      expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: "w1" } });
      expect(mockDelete).toHaveBeenCalledWith({ where: { id: "w1" } });
    });

    it("throws if the widget does not exist", async () => {
      mockFindUnique.mockResolvedValue(null);
      await expect(deleteWidget("missing", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it("throws if the widget is owned by a different user", async () => {
      mockFindUnique.mockResolvedValue({ ...baseRow, userId: "user-2" });
      await expect(deleteWidget("w1", "user-1")).rejects.toThrow();
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  describe("getWidgetData dispatch", () => {
    it("sentiment_summary returns counts grouped by sentiment", async () => {
      mockAnalysisGroupBy.mockResolvedValue([
        { sentiment: "positive", _count: { _all: 10 } },
        { sentiment: "negative", _count: { _all: 4 } },
      ]);
      const { type, data } = await getWidgetData({
        type: "sentiment_summary",
        config: {},
      });
      expect(type).toBe("sentiment_summary");
      expect(data).toEqual({
        type: "sentiment_summary",
        counts: { positive: 10, negative: 4 },
      });
      expect(mockAnalysisGroupBy).toHaveBeenCalledWith({
        by: ["sentiment"],
        _count: { _all: true },
      });
    });

    it("severity_distribution returns sorted distribution", async () => {
      mockAnalysisGroupBy.mockResolvedValue([
        { severityScore: 5, _count: { _all: 2 } },
        { severityScore: 1, _count: { _all: 8 } },
      ]);
      const { type, data } = await getWidgetData({
        type: "severity_distribution",
        config: {},
      });
      expect(type).toBe("severity_distribution");
      const dist = (data as { distribution: { severity: number; count: number }[] }).distribution;
      expect(dist).toEqual([
        { severity: 1, count: 8 },
        { severity: 5, count: 2 },
      ]);
    });

    it("recent_items returns the last 5 items", async () => {
      const ts = new Date("2026-06-01T00:00:00Z");
      mockItemFindMany.mockResolvedValue([
        {
          id: "i1",
          source: "GitHub",
          title: "Bug",
          originalTimestamp: ts,
          analysis: { sentiment: "negative", severityScore: 4, summary: "s", status: "NEW" },
        },
      ]);
      const { type, data } = await getWidgetData({
        type: "recent_items",
        config: {},
      });
      expect(type).toBe("recent_items");
      const items = (data as { items: { id: string }[] }).items;
      expect(items).toHaveLength(1);
      expect(items[0].id).toBe("i1");
      expect(mockItemFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, orderBy: { originalTimestamp: "desc" } })
      );
    });

    it("topic_breakdown aggregates topics from JSON arrays", async () => {
      mockAnalysisFindMany.mockResolvedValue([
        { topics: ["Bug Report", "Performance"] },
        { topics: ["Bug Report"] },
        { topics: "not-an-array" },
      ]);
      const { type, data } = await getWidgetData({
        type: "topic_breakdown",
        config: {},
      });
      expect(type).toBe("topic_breakdown");
      const topics = (data as { topics: { topic: string; count: number }[] }).topics;
      expect(topics).toEqual([
        { topic: "Bug Report", count: 2 },
        { topic: "Performance", count: 1 },
      ]);
    });

    it("trend_sparkline returns 14 daily buckets", async () => {
      mockItemFindMany.mockResolvedValue([]);
      const { type, data } = await getWidgetData({
        type: "trend_sparkline",
        config: {},
      });
      expect(type).toBe("trend_sparkline");
      const series = (data as { series: { date: string }[] }).series;
      expect(series).toHaveLength(14);
    });

    it("returns null data for an unknown type", async () => {
      const { type, data } = await getWidgetData({
        type: "mystery",
        config: {},
      });
      expect(type).toBe("mystery");
      expect(data).toBeNull();
    });
  });
});
