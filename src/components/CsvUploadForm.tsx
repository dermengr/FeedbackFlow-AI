"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { showToast } from "@/lib/toast";

// CSV file upload form. Posts a file to /api/ingest/upload which parses and
// ingests the CSV as feedback items.
export function CsvUploadForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceKey, setSourceKey] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<
    { ok: boolean; message: string; count?: number } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
      // Auto-generate source key from filename if not set
      if (!sourceKey) {
        const base = f.name.replace(/\.csv$/i, "");
        setSourceKey(`csv:${base}`);
      }
    }
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Please select a CSV file");
      return;
    }
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceKey", sourceKey || `csv:${file.name}`);
      const res = await fetch("/api/ingest/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        const message = `Successfully ingested ${data.ingested ?? 0} items.`;
        setResult({
          ok: true,
          message,
          count: data.ingested,
        });
        showToast(message, "success");
        // Reset and refresh after a short delay
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        const message = data.error ?? "Upload failed.";
        setResult({
          ok: false,
          message,
        });
        showToast(message, "error");
      }
    } catch {
      const message = "Network error during upload.";
      setResult({
        ok: false,
        message,
      });
      showToast(message, "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="space-y-4">
      {/* File input */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CSV file</label>
        <div
          className="mt-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition-colors hover:border-slate-400 dark:border-slate-600 dark:bg-slate-800"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFile(f);
              if (!sourceKey) {
                setSourceKey(`csv:${f.name.replace(/\.csv$/i, "")}`);
              }
            }
          }}
        >
          {file ? (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <FileText className="h-5 w-5 text-indigo-500" />
              <span className="font-medium">{file.name}</span>
              <span className="text-slate-400 dark:text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Drag &amp; drop a CSV file here, or
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Browse files
              </button>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          CSV must have columns: title, content, author, timestamp (optional).
        </p>
      </div>

      {/* Source key */}
      <div>
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Source key</label>
        <input
          type="text"
          value={sourceKey}
          onChange={(e) => setSourceKey(e.target.value)}
          placeholder="csv:my-export"
          className="input-modern mt-1 block w-full"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Used for deduplication. Items with the same source key won&apos;t be re-ingested.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
            result.ok
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300"
          }`}
        >
          {result.ok ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={uploading || !file}
          className="inline-flex items-center gap-1.5 btn-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload &amp; ingest
            </>
          )}
        </button>
        {file && (
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setResult(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="btn-secondary"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
