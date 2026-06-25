"use client";

export function ActionItems({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No action items extracted.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
          <svg
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 111.42-1.42l2.79 2.79 6.79-6.79a1 1 0 011.42 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
