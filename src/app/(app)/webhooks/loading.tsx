import { SkeletonPageHeader, SkeletonCard, SkeletonTable } from "@/components/Skeleton";

export default function WebhooksLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={3} />
      <SkeletonTable columns={6} rows={4} />
    </div>
  );
}
