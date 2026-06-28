import { GitHubRepoForm } from "@/components/GitHubRepoForm";
import { Github, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

// GitHub repository link submit form page.
// Lets users paste a GitHub URL to quickly create a feedback ingestion source.
export default function AddGitHubSourcePage() {
  return (
    <PageShell className="mx-auto max-w-2xl space-y-6">
      <PageSection>
        <Link
          href="/sources"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sources
        </Link>
      </PageSection>

      <PageSection>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Github className="h-5 w-5" />
          </span>
          <PageHeader
            title="Add GitHub Repository"
            description="Paste a GitHub repo URL to start ingesting its issues as feedback."
          />
        </div>
      </PageSection>

      <PageSection>
        <div className="card-modern p-6">
          <GitHubRepoForm />
        </div>
      </PageSection>

      <PageSection>
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-700">How it works</h2>
        <ol className="list-inside list-decimal space-y-1">
          <li>Paste any GitHub repository URL above.</li>
          <li>
            We&apos;ll parse the owner/repo and optionally verify it exists.
          </li>
          <li>
            A new ingestion source is created — issues will be fetched on the
            next ingest run.
          </li>
          <li>
            Go to the <Link href="/sources" className="text-indigo-600 hover:underline">Sources page</Link> to enable/disable or trigger a run.
          </li>
        </ol>
      </div>
    </PageSection>
  </PageShell>
  );
}
