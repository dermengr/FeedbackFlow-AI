import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES, SENTIMENTS } from "@/lib/types";

// GET /api/feedback - list feedback with filters, sorting, pagination.
// Query params:
//   sentiment=positive|neutral|negative (repeatable)
//   topic=Bug%20Report (repeatable, substring match on JSON topics)
//   severity=4 (min severity, inclusive)
//   status=NEW|ACKNOWLEDGED|ACTIONED (repeatable)
//   sort=severity|createdAt|originalTimestamp (default: originalTimestamp)
//   order=desc|asc (default: desc)
//   page=1
//   pageSize=20
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const getAll = (key: string): string[] => {
    const vals = url.searchParams.getAll(key).filter(Boolean);
    return vals;
  };

  const sentiments = getAll("sentiment").filter((s) =>
    (SENTIMENTS as readonly string[]).includes(s)
  );
  const topics = getAll("topic");
  const statuses = getAll("status").filter((s) =>
    (FEEDBACK_STATUSES as readonly string[]).includes(s)
  );
  const minSeverity = Number(url.searchParams.get("severity"));
  const severityFilter =
    Number.isFinite(minSeverity) && minSeverity >= 1 && minSeverity <= 5
      ? { gte: Math.floor(minSeverity) }
      : undefined;

  const sortRaw = url.searchParams.get("sort") ?? "originalTimestamp";
  const allowedSorts = ["severity", "createdAt", "originalTimestamp"] as const;
  const sortField = (allowedSorts as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof allowedSorts)[number])
    : "originalTimestamp";
  const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";

  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20)
  );

  // Build the where clause. severity/sentiment/status live on FeedbackAnalysis,
  // topic is a JSON array we match with string_contains.
  const analysisWhere: Record<string, unknown> = {};
  if (sentiments.length) analysisWhere.sentiment = { in: sentiments };
  if (statuses.length) analysisWhere.status = { in: statuses };
  if (severityFilter) analysisWhere.severityScore = severityFilter;

  const itemWhere: Record<string, unknown> = {};
  if (topics.length) {
    // topics is a JSON array; use path + string_contains per topic (OR).
    itemWhere.OR = topics.map((t) => ({
      analysis: { topics: { path: [], string_contains: t } },
    }));
  }
  if (Object.keys(analysisWhere).length) {
    itemWhere.analysis = analysisWhere;
  }

  // Sorting by severity requires ordering on the relation; Prisma supports
  // ordering by a to-one relation column.
  const orderBy: Record<string, unknown> =
    sortField === "severity"
      ? { analysis: { severityScore: order } }
      : { [sortField]: order };

  const [items, total] = await Promise.all([
    prisma.feedbackItem.findMany({
      where: itemWhere,
      include: { analysis: true },
      orderBy: orderBy as never,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.feedbackItem.count({ where: itemWhere }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
