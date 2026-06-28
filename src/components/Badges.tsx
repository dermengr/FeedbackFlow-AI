import { cn } from "@/lib/utils";
import { Sentiment, FeedbackStatus } from "@/lib/types";

const sentimentStyles: Record<Sentiment, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-500/30",
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-500/30",
  negative: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-500/30",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset transition-colors",
        sentimentStyles[sentiment] ?? sentimentStyles.neutral
      )}
    >
      {sentiment}
    </span>
  );
}

const severityStyles: Record<number, string> = {
  1: "bg-slate-100 text-slate-700 ring-slate-500/20 dark:bg-slate-700 dark:text-slate-300 dark:ring-slate-500/30",
  2: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-500/30",
  3: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-500/30",
  4: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-500/30",
  5: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-900/30 dark:text-rose-300 dark:ring-rose-500/30",
};

export function SeverityBadge({ score }: { score: number }) {
  const cls = severityStyles[score] ?? severityStyles[3];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset transition-colors",
        cls
      )}
      title={`Severity ${score}/5`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      S{score}
    </span>
  );
}

const statusStyles: Record<FeedbackStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-500/30",
  ACKNOWLEDGED: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-900/30 dark:text-violet-300 dark:ring-violet-500/30",
  ACTIONED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-500/30",
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset transition-colors",
        statusStyles[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

export function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
      {topic}
    </span>
  );
}
