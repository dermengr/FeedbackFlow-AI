import { prisma } from "@/lib/prisma";

// The set of widget types a user can place on their dashboard.
export const WIDGET_TYPES = [
  "sentiment_summary",
  "severity_distribution",
  "recent_items",
  "topic_breakdown",
  "trend_sparkline",
] as const;

export type WidgetType = (typeof WIDGET_TYPES)[number];

// Input shape accepted by createWidget.
export interface CreateWidgetInput {
  type: string;
  title: string;
  config?: unknown;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
}

// Input shape accepted by updateWidget. All fields optional.
export interface UpdateWidgetInput {
  title?: string;
  config?: unknown;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
}

// A DashboardWidget row as returned by Prisma. `config` is a JSON value and
// the timestamps are Date objects.
export interface WidgetRow {
  id: string;
  userId: string;
  type: string;
  title: string;
  config: unknown;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  createdAt: Date;
  updatedAt: Date;
}

// JSON-safe DTO returned by the widgets service / API routes.
export interface WidgetDto {
  id: string;
  userId: string;
  type: string;
  title: string;
  config: unknown;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
}

// Map a Prisma DashboardWidget row to the JSON-safe DTO.
export function toWidgetDto(row: WidgetRow): WidgetDto {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    config: row.config,
    positionX: row.positionX,
    positionY: row.positionY,
    width: row.width,
    height: row.height,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Validate that a string is one of the supported widget types.
export function isWidgetType(value: string): value is WidgetType {
  return (WIDGET_TYPES as readonly string[]).includes(value);
}

// Clamp a grid dimension (position/size) to a non-negative integer. The
// `fallback` doubles as the minimum: negative inputs are raised to it, so a
// width/height of -1 becomes 1 and a position of -5 becomes 0.
function clampInt(value: number | undefined, fallback: number): number {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return fallback;
  }
  const n = Math.floor(value);
  return n < fallback ? fallback : n;
}

// List all dashboard widgets owned by `userId`, ordered by grid position so
// the UI can render them top-to-bottom, left-to-right.
export async function listWidgets(userId: string): Promise<WidgetDto[]> {
  const rows = await prisma.dashboardWidget.findMany({
    where: { userId },
    orderBy: [{ positionY: "asc" }, { positionX: "asc" }],
  });
  return rows.map(toWidgetDto);
}

// Create a new dashboard widget owned by `userId`. Throws if `type` is not a
// supported widget type.
export async function createWidget(
  userId: string,
  data: CreateWidgetInput
): Promise<WidgetDto> {
  if (!isWidgetType(data.type)) {
    throw new Error(`Unsupported widget type: ${data.type}`);
  }
  const created = await prisma.dashboardWidget.create({
    data: {
      userId,
      type: data.type,
      title: data.title,
      config: (data.config ?? {}) as object,
      positionX: clampInt(data.positionX, 0),
      positionY: clampInt(data.positionY, 0),
      width: clampInt(data.width, 1),
      height: clampInt(data.height, 1),
    },
  });
  return toWidgetDto(created);
}

// Update an existing widget after verifying ownership. Throws if the widget
// does not exist or is owned by a different user.
export async function updateWidget(
  id: string,
  userId: string,
  data: UpdateWidgetInput
): Promise<WidgetDto> {
  const existing = await prisma.dashboardWidget.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Widget not found or not owned by user");
  }

  const update: Record<string, unknown> = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.config !== undefined) update.config = data.config as object;
  if (data.positionX !== undefined) update.positionX = clampInt(data.positionX, 0);
  if (data.positionY !== undefined) update.positionY = clampInt(data.positionY, 0);
  if (data.width !== undefined) update.width = clampInt(data.width, 1);
  if (data.height !== undefined) update.height = clampInt(data.height, 1);

  const updated = await prisma.dashboardWidget.update({
    where: { id },
    data: update,
  });
  return toWidgetDto(updated);
}

// Delete a widget after verifying ownership. Throws if the widget does not
// exist or is owned by a different user.
export async function deleteWidget(id: string, userId: string): Promise<void> {
  const existing = await prisma.dashboardWidget.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    throw new Error("Widget not found or not owned by user");
  }
  await prisma.dashboardWidget.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Widget data fetchers — dispatch on widget.type to return the appropriate
// aggregated payload. Each branch returns a JSON-serializable object.
// ---------------------------------------------------------------------------

// Count analyses grouped by sentiment.
async function sentimentSummary() {
  const groups = await prisma.feedbackAnalysis.groupBy({
    by: ["sentiment"],
    _count: { _all: true },
  });
  return {
    type: "sentiment_summary",
    counts: Object.fromEntries(
      groups.map((g) => [g.sentiment, g._count._all])
    ),
  };
}

// Count analyses grouped by severityScore.
async function severityDistribution() {
  const groups = await prisma.feedbackAnalysis.groupBy({
    by: ["severityScore"],
    _count: { _all: true },
  });
  return {
    type: "severity_distribution",
    distribution: groups
      .map((g) => ({ severity: g.severityScore, count: g._count._all }))
      .sort((a, b) => a.severity - b.severity),
  };
}

// Last 5 feedback items (newest first) with their analysis.
async function recentItems() {
  const items = await prisma.feedbackItem.findMany({
    orderBy: { originalTimestamp: "desc" },
    take: 5,
    include: {
      analysis: {
        select: {
          sentiment: true,
          severityScore: true,
          summary: true,
          status: true,
        },
      },
    },
  });
  return {
    type: "recent_items",
    items: items.map((it) => ({
      id: it.id,
      source: it.source,
      title: it.title,
      sentiment: it.analysis?.sentiment ?? null,
      severity: it.analysis?.severityScore ?? null,
      summary: it.analysis?.summary ?? null,
      status: it.analysis?.status ?? null,
      originalTimestamp: it.originalTimestamp.toISOString(),
    })),
  };
}

// Count of analyses per topic. `topics` is a JSON array stored on each
// analysis; we read all rows and aggregate in JS (fine for SMB scale).
async function topicBreakdown() {
  const rows = await prisma.feedbackAnalysis.findMany({
    select: { topics: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const arr = Array.isArray(row.topics) ? (row.topics as unknown[]) : [];
    for (const t of arr) {
      if (typeof t === "string") {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
  }
  return {
    type: "topic_breakdown",
    topics: Array.from(counts.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Daily sentiment counts for the last 14 days — a compact sparkline series.
async function trendSparkline() {
  const since = new Date();
  since.setDate(since.getDate() - 14);
  since.setHours(0, 0, 0, 0);

  const items = await prisma.feedbackItem.findMany({
    where: { originalTimestamp: { gte: since } },
    select: {
      originalTimestamp: true,
      analysis: { select: { sentiment: true } },
    },
  });

  const days: {
    date: string;
    positive: number;
    neutral: number;
    negative: number;
  }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push({
      date: d.toISOString().slice(0, 10),
      positive: 0,
      neutral: 0,
      negative: 0,
    });
  }
  const dayMap = new Map(days.map((d) => [d.date, d]));
  for (const it of items) {
    const key = new Date(it.originalTimestamp).toISOString().slice(0, 10);
    const bucket = dayMap.get(key);
    if (bucket && it.analysis?.sentiment) {
      bucket[it.analysis.sentiment as "positive" | "neutral" | "negative"]++;
    }
  }
  return { type: "trend_sparkline", series: days };
}

// Fetch the data payload for a given widget, dispatching on its `type`.
// Returns `{ type, data: null }` for unsupported types so the UI can degrade
// gracefully rather than throwing.
export async function getWidgetData(
  widget: Pick<WidgetRow, "type" | "config">
): Promise<{ type: string; data: unknown }> {
  switch (widget.type) {
    case "sentiment_summary":
      return { type: widget.type, data: await sentimentSummary() };
    case "severity_distribution":
      return { type: widget.type, data: await severityDistribution() };
    case "recent_items":
      return { type: widget.type, data: await recentItems() };
    case "topic_breakdown":
      return { type: widget.type, data: await topicBreakdown() };
    case "trend_sparkline":
      return { type: widget.type, data: await trendSparkline() };
    default:
      return { type: widget.type, data: null };
  }
}
