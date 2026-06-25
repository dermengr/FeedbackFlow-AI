import { GitHubRepoForm } from "@/components/GitHubRepoForm";
import { Github, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

// GitHub repository link submit form page.
// Lets users paste a GitHub URL to quickly create a feedback ingestion source.
export default function AddGitHubSourcePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/sources"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sources
      </Link>

      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Github className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              Add GitHub Repository
            </h1>
            <p className="text-sm text-slate-500">
              Paste a GitHub repo URL to start ingesting its issues as feedback.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <GitHubRepoForm />
      </div>

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
    </div>
  );
}
