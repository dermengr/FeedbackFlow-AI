import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Filters } from "@/components/Filters";
import { SavedViewsSidebar } from "@/components/SavedViewsSidebar";
import { InboxInteractions } from "@/components/InboxInteractions";
import {
  SentimentBadge,
  SeverityBadge,
  StatusBadge,
  TopicChip,
} from "@/components/Badges";
import { formatDate, truncate } from "@/lib/utils";
import { SENTIMENTS, FEEDBACK_STATUSES } from "@/lib/types";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";

interface SearchParams {
  sentiment?: string | string[];
  topic?: string | string[];
  status?: string | string[];
  severity?: string;
  sort?: string;
  order?: string;
  page?: string;
  pageSize?: string;
  snoozed?: string;
}

function asArray(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sentiments = asArray(searchParams.sentiment).filter((s) =>
    (SENTIMENTS as readonly string[]).includes(s)
  );
  const topics = asArray(searchParams.topic);
  const statuses = asArray(searchParams.status).filter((s) =>
    (FEEDBACK_STATUSES as readonly string[]).includes(s)
  );
  const minSeverity = Number(searchParams.severity);
  const severityFilter =
    Number.isFinite(minSeverity) && minSeverity >= 1 && minSeverity <= 5
      ? { gte: Math.floor(minSeverity) }
      : undefined;

  const sortRaw = searchParams.sort ?? "originalTimestamp";
  const allowedSorts = ["severity", "createdAt", "originalTimestamp"] as const;
  const sortField = (allowedSorts as readonly string[]).includes(sortRaw)
    ? (sortRaw as (typeof allowedSorts)[number])
    : "originalTimestamp";
  const order = searchParams.order === "asc" ? "asc" : "desc";

  const page = Math.max(1, Number(searchParams.page ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.pageSize ?? 25) || 25)
  );

  const analysisWhere: Record<string, unknown> = {};
  if (sentiments.length) analysisWhere.sentiment = { in: sentiments };
  if (statuses.length) analysisWhere.status = { in: statuses };
  if (severityFilter) analysisWhere.severityScore = severityFilter;

  const itemWhere: Record<string, unknown> = {
    archive: null,
  };
  if (topics.length) {
    itemWhere.OR = topics.map((t) => ({
      analysis: { topics: { path: [], string_contains: t } },
    }));
  }
  // C15: hide snoozed items by default (unless snoozed filter is explicitly set).
  const showSnoozed = searchParams.snoozed === "1";
  if (!showSnoozed && Object.keys(analysisWhere).length === 0) {
    itemWhere.analysis = { OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }] };
  } else if (!showSnoozed && Object.keys(analysisWhere).length > 0) {
    analysisWhere.AND = [{ OR: [{ snoozedUntil: null }, { snoozedUntil: { lt: new Date() } }] }];
    itemWhere.analysis = analysisWhere;
  } else if (Object.keys(analysisWhere).length) {
    itemWhere.analysis = analysisWhere;
  }

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

  // Topic options from existing data so the filter UI reflects reality.
  const topicRows = await prisma.feedbackAnalysis.findMany({
    select: { topics: true },
  });
  const topicSet = new Set<string>();
  for (const r of topicRows) {
    if (Array.isArray(r.topics)) (r.topics as unknown[]).forEach((t) => {
      if (typeof t === "string") topicSet.add(t);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const itemIds = items.map((i) => i.id);
  const exportQuery = new URLSearchParams();
  if (sentiments.length) sentiments.forEach((s) => exportQuery.append("sentiment", s));
  if (topics.length) topics.forEach((t) => exportQuery.append("topic", t));
  if (statuses.length) statuses.forEach((s) => exportQuery.append("status", s));
  if (severityFilter) exportQuery.set("severity", String(minSeverity));
  if (sortField !== "originalTimestamp") exportQuery.set("sort", sortField);
  if (order === "asc") exportQuery.set("order", "asc");

  return (
    <div className="flex gap-6">
      {/* Sidebar with saved views */}
      <aside className="hidden w-56 shrink-0 lg:block">
        <SavedViewsSidebar />
      </aside>

      <div className="flex-1 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Feedback Inbox</h1>
            <p className="text-sm text-slate-500">
              {total} item{total === 1 ? "" : "s"}
              {sentiments.length || topics.length || statuses.length || severityFilter
                ? " (filtered)"
                : ""}
            </p>
          </div>
          <a
            href={`/api/feedback/export?${exportQuery.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>

        <Filters topicOptions={Array.from(topicSet).sort()} />

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    id="inbox-select-all"
                    className="rounded border-slate-300"
                  />
                </th>
                <th className="px-4 py-3">Title / Source</th>
                <th className="px-4 py-3">Sentiment</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Topics</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    No feedback matches your filters.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300"
                      data-item-id={item.id}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/inbox/${item.id}`}
                      className="font-medium text-slate-900 hover:text-brand-700"
                    >
                      {truncate(item.title ?? item.externalId, 70)}
                    </Link>
                    <div className="text-xs text-slate-400">
                      {item.source} • {item.authorLogin ?? "unknown"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.analysis ? (
                      <SentimentBadge sentiment={item.analysis.sentiment as never} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.analysis ? (
                      <SeverityBadge score={item.analysis.severityScore} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {(item.analysis?.topics as string[] | undefined)?.slice(0, 3).map((t) => (
                        <TopicChip key={t} topic={t} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {item.analysis ? (
                      <StatusBadge status={item.analysis.status as never} />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(item.originalTimestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/inbox?${qs(searchParams, { page: String(page - 1) })}`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-100"
                  >
                    Prev
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={`/inbox?${qs(searchParams, { page: String(page + 1) })}`}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-700 hover:bg-slate-100"
                  >
                    Next
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <InboxInteractions itemIds={itemIds} />
    </div>
  );
}

function qs(
  base: SearchParams,
  overrides: Record<string, string>
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
    else sp.append(k, v);
  }
  for (const [k, v] of Object.entries(overrides)) sp.set(k, v);
  return sp.toString();
}
