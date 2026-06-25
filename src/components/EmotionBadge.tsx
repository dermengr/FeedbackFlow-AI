import { cn } from "@/lib/utils";

const emotionStyles: Record<string, string> = {
  angry: "bg-rose-50 text-rose-700 ring-rose-600/20",
  frustrated: "bg-red-50 text-red-700 ring-red-600/20",
  confused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  disappointed: "bg-amber-50 text-amber-700 ring-amber-600/20",
  neutral: "bg-slate-100 text-slate-700 ring-slate-500/20",
  happy: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  excited: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
};

export function EmotionBadge({ emotion }: { emotion: string }) {
  const cls = emotionStyles[emotion] ?? emotionStyles.neutral;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        cls
      )}
    >
      {emotion}
    </span>
  );
}
