import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FEEDBACK_STATUSES, SENTIMENTS } from "@/lib/types";
import { itemsToCsv, type ExportItem } from "@/lib/export";

// GET /api/feedback/export - export ALL matching feedback as CSV.
// Uses the SAME filter/sort query params as GET /api/feedback:
//   sentiment=positive|neutral|negative (repeatable)
//   topic=Bug%20Report (repeatable, substring match on JSON topics)
//   severity=4 (min severity, inclusive)
//   status=NEW|ACKNOWLEDGED|ACTIONED (repeatable)
//   sort=severity|createdAt|originalTimestamp (default: originalTimestamp)
//   order=desc|asc (default: desc)
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

  const items = await prisma.feedbackItem.findMany({
    where: itemWhere,
    include: { analysis: true },
    orderBy: orderBy as never,
    // Fetch all matching items (no pagination), capped at 10000.
    take: 10000,
  });

  const csv = itemsToCsv(items as ExportItem[]);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=feedback-export.csv",
    },
  });
}
