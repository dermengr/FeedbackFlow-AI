import { SkeletonPageHeader, SkeletonKpiCard, SkeletonCard } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
        <SkeletonKpiCard />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard title />
        <SkeletonCard title />
        <SkeletonCard title />
        <SkeletonCard title />
      </div>
    </div>
  );
}
