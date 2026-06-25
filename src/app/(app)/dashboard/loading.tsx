// Loading skeleton for the dashboard page (Next.js App Router convention).

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-64 animate-pulse rounded bg-stone-200" />
        <div className="mt-2 h-4 w-96 animate-pulse rounded bg-stone-200" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div className="h-4 w-24 animate-pulse rounded bg-stone-200" />
            <div className="mt-3 h-8 w-16 animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded bg-stone-200" />
            <div className="mt-4 h-48 w-full animate-pulse rounded bg-stone-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
