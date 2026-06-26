import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  SentimentBadge,
  SeverityBadge,
  StatusBadge,
  TopicChip,
} from "@/components/Badges";
import { StatusSelect } from "@/components/StatusSelect";
import { EmotionBadge } from "@/components/EmotionBadge";
import { LanguageBadge } from "@/components/LanguageBadge";
import { ActionItems } from "@/components/ActionItems";
import { AssigneeSelect } from "@/components/AssigneeSelect";
import { SnoozeButton } from "@/components/SnoozeButton";
import { LabelManager } from "@/components/LabelManager";
import { Comments } from "@/components/Comments";
import { ActivityTab } from "@/components/ActivityTab";
import { SimilarItems } from "@/components/SimilarItems";
import { ReplyGenerator } from "@/components/ReplyGenerator";
import { TranslationButton } from "@/components/TranslationButton";
import { ArchiveButton } from "@/components/ArchiveButton";
import { VoteButtons } from "@/components/VoteButtons";
import { FeedbackLinks } from "@/components/FeedbackLinks";
import { SmartCategorization } from "@/components/SmartCategorization";
import { formatDate } from "@/lib/utils";
import { ChevronLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FeedbackDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await prisma.feedbackItem.findUnique({
    where: { id: params.id },
    include: {
      analysis: true,
      labels: { include: { label: true } },
      archive: true,
    },
  });
  if (!item) notFound();

  const analysis = item.analysis;
  const topics = (analysis?.topics as string[] | undefined) ?? [];
  const actionItems = (analysis?.actionItems as string[] | undefined) ?? [];
  const labels = item.labels.map((fl) => ({
    id: fl.label.id,
    name: fl.label.name,
    color: fl.label.color,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/inbox"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to inbox
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Raw content */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-700">Raw feedback</h2>
            <div className="flex items-center gap-2">
              <ArchiveButton feedbackItemId={item.id} isArchived={Boolean(item.archive)} />
              <VoteButtons feedbackItemId={item.id} />
              <span className="text-xs text-slate-400">{item.source}</span>
            </div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {item.title ?? item.externalId}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>By {item.authorLogin ?? "unknown"}</span>
            <span>•</span>
            <span>{formatDate(item.originalTimestamp)}</span>
            <span>•</span>
            <span className="font-mono">{item.externalId}</span>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 inline-flex items-center gap-0.5 text-brand-700 hover:text-brand-800"
              >
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <pre className="mt-4 max-h-[480px] overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-4 text-sm text-slate-800">
            {item.rawContent}
          </pre>
        </section>

        {/* AI analysis + triage */}
        <section className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">AI analysis</h2>

            {analysis ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Summary
                  </dt>
                  <dd className="mt-1 text-sm text-slate-800">{analysis.summary}</dd>
                </div>

                <div className="flex flex-wrap gap-6">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Sentiment
                    </dt>
                    <dd className="mt-1">
                      <SentimentBadge sentiment={analysis.sentiment as never} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Severity
                    </dt>
                    <dd className="mt-1">
                      <SeverityBadge score={analysis.severityScore} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Status
                    </dt>
                    <dd className="mt-1">
                      <StatusBadge status={analysis.status as never} />
                    </dd>
                  </div>
                  {analysis.emotion && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Emotion
                      </dt>
                      <dd className="mt-1">
                        <EmotionBadge emotion={analysis.emotion} />
                      </dd>
                    </div>
                  )}
                </div>

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Topics
                  </dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {topics.map((t) => (
                      <TopicChip key={t} topic={t} />
                    ))}
                  </dd>
                </div>

                {analysis.language && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Language
                    </dt>
                    <dd className="mt-1">
                      <LanguageBadge
                        language={analysis.language}
                        translatedSummary={analysis.translatedSummary}
                      />
                    </dd>
                  </div>
                )}

                {actionItems.length > 0 && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Action items
                    </dt>
                    <dd className="mt-1">
                      <ActionItems items={actionItems} />
                    </dd>
                  </div>
                )}

                {analysis.language && (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      AI Translation
                    </dt>
                    <dd className="mt-1">
                      <TranslationButton
                        feedbackItemId={item.id}
                        language={analysis.language}
                        hasTranslation={Boolean(analysis.translatedSummary)}
                        initialTranslation={analysis.translatedSummary}
                      />
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Smart categories
                  </dt>
                  <dd className="mt-1">
                    <SmartCategorization feedbackItemId={item.id} />
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-slate-400">
                No analysis available for this item.
              </p>
            )}
          </div>

          {analysis && (
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold text-slate-700">Triage</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <div className="mt-1">
                    <StatusSelect itemId={item.id} status={analysis.status as never} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Assignee
                  </label>
                  <div className="mt-1">
                    <AssigneeSelect
                      feedbackItemId={item.id}
                      currentAssigneeId={analysis.assignedToId}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Snooze
                  </label>
                  <div className="mt-1">
                    <SnoozeButton
                      feedbackItemId={item.id}
                      snoozedUntil={
                        analysis.snoozedUntil
                          ? analysis.snoozedUntil.toISOString()
                          : null
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Labels */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Labels</h2>
            <LabelManager feedbackItemId={item.id} />
          </div>

          {/* Similar items (semantic) */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Similar items
            </h2>
            <SimilarItems feedbackItemId={item.id} />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Related links
            </h2>
            <FeedbackLinks feedbackItemId={item.id} />
          </div>

          <ReplyGenerator feedbackItemId={item.id} />
        </section>
      </div>

      {/* Bottom row: comments + activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Comments</h2>
          <Comments feedbackItemId={item.id} />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Activity</h2>
          <ActivityTab feedbackItemId={item.id} />
        </div>
      </div>
    </div>
  );
}
