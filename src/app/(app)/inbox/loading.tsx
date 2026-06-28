import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/Skeleton";

export default function InboxLoading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />

      <div className="flex gap-3">
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
        <Skeleton className="h-9 w-28 rounded" />
      </div>

      <SkeletonTable columns={5} rows={8} />
    </div>
  );
}
