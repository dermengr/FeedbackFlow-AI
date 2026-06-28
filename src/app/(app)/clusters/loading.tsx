import { SkeletonPageHeader, SkeletonCard } from "@/components/Skeleton";

export default function ClustersLoading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCard title rows={6} />
    </div>
  );
}
