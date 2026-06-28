import { CsvUploadForm } from "@/components/CsvUploadForm";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

// CSV upload page — lets users upload a CSV file to bulk-ingest feedback.
export default function CsvUploadPage() {
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
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Upload className="h-5 w-5" />
          </span>
          <PageHeader
            title="Upload CSV"
            description="Bulk-ingest feedback from a CSV file."
          />
        </div>
      </PageSection>

      <PageSection>
        <div className="card-modern p-6">
          <CsvUploadForm />
        </div>
      </PageSection>

      <PageSection>
        <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
        <h2 className="mb-2 font-semibold text-slate-700">CSV format</h2>
        <p className="mb-2">The file must have a header row with these columns:</p>
        <ul className="list-inside list-disc space-y-1">
          <li><code>title</code> — short title/summary of the feedback</li>
          <li><code>content</code> — the full feedback text</li>
          <li><code>author</code> — author name or email (optional)</li>
          <li><code>timestamp</code> — ISO date string (optional, defaults to now)</li>
          <li><code>url</code> — source URL (optional)</li>
        </ul>
      </div>
    </PageSection>
  </PageShell>
  );
}
