import { MessageSquareWarning } from "lucide-react";

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white">
            <MessageSquareWarning className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold">FeedbackFlow AI</span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="h-6 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 space-y-4">
            <div className="h-10 animate-pulse rounded-md bg-slate-100" />
            <div className="h-10 animate-pulse rounded-md bg-slate-100" />
            <div className="h-10 animate-pulse rounded-md bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}