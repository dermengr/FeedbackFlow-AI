import { cn } from "@/lib/utils";
import { Sentiment, FeedbackStatus } from "@/lib/types";

const sentimentStyles: Record<Sentiment, string> = {
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
  negative: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function SentimentBadge({ sentiment }: { sentiment: Sentiment }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        sentimentStyles[sentiment] ?? sentimentStyles.neutral
      )}
    >
      {sentiment}
    </span>
  );
}

const severityStyles: Record<number, string> = {
  1: "bg-slate-100 text-slate-700 ring-slate-500/20",
  2: "bg-sky-50 text-sky-700 ring-sky-600/20",
  3: "bg-amber-50 text-amber-700 ring-amber-600/20",
  4: "bg-orange-50 text-orange-700 ring-orange-600/20",
  5: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

export function SeverityBadge({ score }: { score: number }) {
  const cls = severityStyles[score] ?? severityStyles[3];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
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
  NEW: "bg-blue-50 text-blue-700 ring-blue-600/20",
  ACKNOWLEDGED: "bg-violet-50 text-violet-700 ring-violet-600/20",
  ACTIONED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function StatusBadge({ status }: { status: FeedbackStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        statusStyles[status]
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

export function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
      {topic}
    </span>
  );
}
