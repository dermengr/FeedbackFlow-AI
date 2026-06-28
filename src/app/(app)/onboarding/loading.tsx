import { SkeletonPageHeader, SkeletonCard } from "@/components/Skeleton";

export default function OnboardingLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonCard title rows={2} />
      <div className="space-y-3">
        <SkeletonCard rows={3} />
        <SkeletonCard rows={3} />
        <SkeletonCard rows={3} />
      </div>
    </div>
  );
}
