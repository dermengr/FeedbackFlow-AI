import { SkeletonPageHeader, SkeletonCard } from "@/components/Skeleton";

export default function NewSourceLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={4} />
    </div>
  );
}
