"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";

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
        setResult({
          ok: true,
          message: `Successfully ingested ${data.ingested ?? 0} items.`,
          count: data.ingested,
        });
        // Reset and refresh after a short delay
        setTimeout(() => {
          router.refresh();
        }, 1000);
      } else {
        setResult({
          ok: false,
          message: data.error ?? "Upload failed.",
        });
      }
    } catch {
      setResult({
        ok: false,
        message: "Network error during upload.",
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={upload} className="space-y-4">
      {/* File input */}
      <div>
        <label className="text-sm font-medium text-slate-700">CSV file</label>
        <div
          className="mt-1 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center"
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
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <FileText className="h-5 w-5 text-indigo-500" />
              <span className="font-medium">{file.name}</span>
              <span className="text-slate-400">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <>
              <Upload className="h-8 w-8 text-slate-400" />
              <p className="mt-2 text-sm text-slate-500">
                Drag &amp; drop a CSV file here, or
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
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
        <p className="mt-1 text-xs text-slate-500">
          CSV must have columns: title, content, author, timestamp (optional).
        </p>
      </div>

      {/* Source key */}
      <div>
        <label className="text-sm font-medium text-slate-700">Source key</label>
        <input
          type="text"
          value={sourceKey}
          onChange={(e) => setSourceKey(e.target.value)}
          placeholder="csv:my-export"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Used for deduplication. Items with the same source key won&apos;t be re-ingested.
        </p>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-sm ${
            result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
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
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
