import { SkeletonPageHeader, SkeletonCard, SkeletonKpiCard } from "@/components/Skeleton";

export default function HealthLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />

      <SkeletonCard title rows={2} />
      <SkeletonCard title rows={4} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SkeletonCard title rows={3} />
        <SkeletonCard title rows={3} />
      </div>
    </div>
  );
}
