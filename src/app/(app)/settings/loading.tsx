import { SkeletonPageHeader, SkeletonCard } from "@/components/Skeleton";

export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={4} />
      <SkeletonCard title rows={5} />
    </div>
  );
}
