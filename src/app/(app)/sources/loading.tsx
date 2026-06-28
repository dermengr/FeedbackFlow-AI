import { SkeletonPageHeaderWithAction, SkeletonCard } from "@/components/Skeleton";

export default function SourcesLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeaderWithAction />

      <div className="grid gap-4">
        <SkeletonCard title rows={3} />
        <SkeletonCard title rows={3} />
        <SkeletonCard title rows={3} />
      </div>
    </div>
  );
}
