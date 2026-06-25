// Loading skeleton for the inbox page (Next.js App Router convention).

export default function InboxLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded bg-stone-200" />

      {/* Filter bar skeleton */}
      <div className="flex gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-28 animate-pulse rounded bg-stone-200" />
        ))}
      </div>

      {/* Table skeleton */}
      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-3">
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-4 w-20 animate-pulse rounded bg-stone-200" />
            ))}
          </div>
        </div>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="border-b border-stone-100 px-4 py-3">
            <div className="flex gap-4">
              <div className="h-4 w-16 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-48 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-20 animate-pulse rounded bg-stone-200" />
              <div className="h-4 w-32 animate-pulse rounded bg-stone-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
