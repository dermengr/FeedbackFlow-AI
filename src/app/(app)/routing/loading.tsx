import { SkeletonPageHeader, SkeletonTable } from "@/components/Skeleton";

export default function RoutingLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable columns={5} rows={5} />
    </div>
  );
}
