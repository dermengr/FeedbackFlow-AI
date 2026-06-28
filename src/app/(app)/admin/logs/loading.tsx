import { SkeletonPageHeader, SkeletonTable } from "@/components/Skeleton";

export default function IngestLogsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable columns={6} rows={8} />
    </div>
  );
}
