import { Skeleton, SkeletonCard } from "@/components/Skeleton";

export default function FeedbackDetailLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-24" />

      <SkeletonCard title rows={3} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SkeletonCard title rows={4} />
        <SkeletonCard title rows={4} />
      </div>

      <SkeletonCard title rows={5} />
    </div>
  );
}
