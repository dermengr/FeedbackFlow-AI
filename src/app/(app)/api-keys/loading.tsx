import { SkeletonPageHeader, SkeletonCard, SkeletonTable } from "@/components/Skeleton";

export default function ApiKeysLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={2} />
      <SkeletonTable columns={4} rows={4} />
    </div>
  );
}
