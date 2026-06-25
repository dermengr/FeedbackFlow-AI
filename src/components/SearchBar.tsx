"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn, truncate } from "@/lib/utils";

type SearchResult = {
  id: string;
  title: string | null;
  rawContent: string;
  externalId: string;
  url: string | null;
  sentiment: string | null;
  summary: string | null;
  tsRank: number;
};

const sentimentDotStyles: Record<string, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-slate-400",
  negative: "bg-rose-500",
};

function sentimentDotClass(sentiment: string | null): string {
  if (sentiment && sentimentDotStyles[sentiment]) return sentimentDotStyles[sentiment];
  return "bg-slate-300";
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search: when query changes (and is non-empty), wait 300ms then fetch.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&pageSize=5`
        );
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = (await res.json()) as {
          results: SearchResult[];
          total: number;
          page: number;
          pageSize: number;
        };
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Click outside to close.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function navigateTo(id: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/inbox/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      if (results.length > 0) {
        e.preventDefault();
        navigateTo(results[0].id);
      }
    }
  }

  function handleFocus() {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    if (query.trim().length >= 2) {
      setOpen(true);
    }
  }

  function handleBlur() {
    // Small delay so result clicks register before closing.
    blurTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  function handleResultClick(id: string) {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    navigateTo(id);
  }

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="Search feedback..."
          aria-label="Search feedback"
          className={cn(
            "w-96 rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900",
            "placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          )}
        />
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-96 max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading ? (
            <div className="px-3 py-2 text-sm text-slate-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">No results found</div>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onMouseDown={(e) => {
                  // Prevent input blur firing before click.
                  e.preventDefault();
                }}
                onClick={() => handleResultClick(r.id)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    sentimentDotClass(r.sentiment)
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {truncate(r.title || r.rawContent, 80)}
                  </span>
                  {r.summary && (
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {truncate(r.summary, 120)}
                    </span>
                  )}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
