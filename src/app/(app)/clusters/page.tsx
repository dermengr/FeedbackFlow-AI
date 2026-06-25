import { ClustersView } from "@/components/ClustersView";

export const dynamic = "force-dynamic";

// Semantic clustering page — groups feedback items by embedding similarity.
export default function ClustersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Semantic Clusters</h1>
        <p className="text-sm text-slate-500">
          Feedback items grouped by semantic similarity. Adjust the threshold to
          control how tightly items are clustered together.
        </p>
      </div>
      <ClustersView />
    </div>
  );
}
