import { SkeletonPageHeader, SkeletonCard } from "@/components/Skeleton";

export default function RolesAdminLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={6} />
    </div>
  );
}
