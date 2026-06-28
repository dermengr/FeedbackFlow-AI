import { SkeletonPageHeader, SkeletonTable } from "@/components/Skeleton";

export default function TeamLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable columns={5} rows={6} />
    </div>
  );
}
