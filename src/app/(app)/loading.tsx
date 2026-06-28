import { PageShell, PageHeader, PageSection, AnimatedCard } from "@/components/PageShell";
import { Skeleton } from "@/components/Skeleton";

export default function AppLoading() {
  return (
    <PageShell className="space-y-6">
      <PageHeader title="Loading…" description="" />
      <PageSection>
        <AnimatedCard className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Skeleton className="h-8 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-32" />
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </AnimatedCard>
      </PageSection>
    </PageShell>
  );
}
