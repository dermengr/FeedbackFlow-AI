"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";

interface SearchHistoryEntry {
  id: string;
  query: string;
  resultsCount: number;
  createdAt: string;
}

interface SearchHistoryProps {
  compact?: boolean;
  onSelect?: (query: string) => void;
}

export function SearchHistory({ compact, onSelect }: SearchHistoryProps) {
  const router = useRouter();
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/search/history?limit=20");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load search history");
      }
      const data = (await res.json()) as { history: SearchHistoryEntry[] };
      setHistory(data.history ?? []);
    } catch (err) {
      showToast(
        "Failed to load search history",
        "error",
        err instanceof Error ? err.message : undefined
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleClear() {
    try {
      const res = await fetch("/api/search/history", { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to clear history");
      }
      setHistory([]);
      showToast("Search history cleared", "success");
    } catch (err) {
      showToast(
        "Failed to clear search history",
        "error",
        err instanceof Error ? err.message : undefined
      );
    }
  }

  function handleSelect(query: string) {
    if (onSelect) {
      onSelect(query);
    } else {
      router.push(`/inbox?q=${encodeURIComponent(query)}`);
    }
  }

  if (loading) {
    return (
      <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
        Loading history…
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="px-3 py-2 text-sm text-slate-400 dark:text-slate-500">
        No recent searches.
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", !compact && "card-modern p-4")}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Recent searches
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
        >
          Clear
        </button>
      </div>
      <ul className="space-y-0.5">
        {history.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => handleSelect(entry.query)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <span className="truncate">{entry.query}</span>
              {!compact && (
                <span className="ml-2 shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {formatDate(entry.createdAt)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchHistoryDropdown({
  onSelect,
}: {
  onSelect: (query: string) => void;
}) {
  return (
    <div className="py-1">
      <SearchHistory compact onSelect={onSelect} />
    </div>
  );
}
