import { cn } from "@/lib/utils";

const colorStyles: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  red: "bg-red-100 text-red-700 border-red-200",
  orange: "bg-orange-100 text-orange-700 border-orange-200",
  amber: "bg-amber-100 text-amber-700 border-amber-200",
  yellow: "bg-yellow-100 text-yellow-700 border-yellow-200",
  green: "bg-green-100 text-green-700 border-green-200",
  teal: "bg-teal-100 text-teal-700 border-teal-200",
  blue: "bg-blue-100 text-blue-700 border-blue-200",
  indigo: "bg-indigo-100 text-indigo-700 border-indigo-200",
  purple: "bg-purple-100 text-purple-700 border-purple-200",
  pink: "bg-pink-100 text-pink-700 border-pink-200",
};

export function LabelChips({
  labels,
}: {
  labels: Array<{ name: string; color: string }>;
}) {
  if (!labels || labels.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {labels.map((label, idx) => {
        const cls = colorStyles[label.color] ?? colorStyles.slate;
        return (
          <span
            key={`${label.name}-${idx}`}
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              cls
            )}
          >
            {label.name}
          </span>
        );
      })}
    </div>
  );
}
