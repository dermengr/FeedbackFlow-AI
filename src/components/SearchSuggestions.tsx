"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

type Suggestions = {
  history: string[];
  popular: string[];
  combined: string[];
};

interface SearchSuggestionsProps {
  query: string;
  onSuggestionClick: (s: string) => void;
}

const DEBOUNCE_MS = 200;

/**
 * Smart Search Suggestions dropdown.
 *
 * Debounces the incoming `query` and fetches suggestions from
 * /api/search/suggestions?q=. Renders "Recent" and "Popular" sections and
 * supports keyboard navigation (ArrowUp / ArrowDown / Enter / Escape).
 */
export function SearchSuggestions({
  query,
  onSuggestionClick,
}: SearchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestions>({
    history: [],
    popular: [],
    combined: [],
  });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Debounced fetch of suggestions whenever the query changes.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();
    if (q.length < 1) {
      setSuggestions({ history: [], popular: [], combined: [] });
      setLoading(false);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    setOpen(true);

    debounceRef.current = setTimeout(async () => {
      // Cancel any in-flight request before starting a new one.
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(q)}`,
          { signal: controller.signal }
        );
        if (!res.ok) {
          setSuggestions({ history: [], popular: [], combined: [] });
          return;
        }
        const data = (await res.json()) as Suggestions;
        setSuggestions({
          history: data.history ?? [],
          popular: data.popular ?? [],
          combined: data.combined ?? [],
        });
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSuggestions({ history: [], popular: [], combined: [] });
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close the dropdown on outside pointer down.
  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const flat = suggestions.combined;

  const choose = useCallback(
    (s: string) => {
      setOpen(false);
      setActiveIndex(-1);
      onSuggestionClick(s);
    },
    [onSuggestionClick]
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!open || flat.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < flat.length) {
        e.preventDefault();
        choose(flat[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  // Determine which section a given flat index belongs to.
  function sectionOf(s: string): "history" | "popular" {
    return suggestions.history.some(
      (h) => h.toLowerCase() === s.toLowerCase()
    )
      ? "history"
      : "popular";
  }

  const showDropdown = open && (loading || flat.length > 0);

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={handleKeyDown}
      role="combobox"
      aria-expanded={open}
      aria-controls="search-suggestions-listbox"
      aria-haspopup="listbox"
      aria-owns="search-suggestions-listbox"
    >
      {showDropdown && (
        <div
          id="search-suggestions-listbox"
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-80 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500">
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              Loading suggestions...
            </div>
          ) : (
            <>
              {suggestions.history.length > 0 && (
                <SuggestionSection
                  title="Recent"
                  icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
                  items={suggestions.history}
                  flat={flat}
                  activeIndex={activeIndex}
                  onHover={setActiveIndex}
                  onChoose={choose}
                  sectionOf={sectionOf}
                />
              )}
              {suggestions.popular.length > 0 && (
                <SuggestionSection
                  title="Popular"
                  icon={<TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />}
                  items={suggestions.popular}
                  flat={flat}
                  activeIndex={activeIndex}
                  onHover={setActiveIndex}
                  onChoose={choose}
                  sectionOf={sectionOf}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface SuggestionSectionProps {
  title: string;
  icon: React.ReactNode;
  items: string[];
  flat: string[];
  activeIndex: number;
  onHover: (i: number) => void;
  onChoose: (s: string) => void;
  sectionOf: (s: string) => "history" | "popular";
}

function SuggestionSection({
  title,
  icon,
  items,
  flat,
  activeIndex,
  onHover,
  onChoose,
  sectionOf,
}: SuggestionSectionProps) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {icon}
        {title}
      </div>
      {items.map((s) => {
        const flatIndex = flat.findIndex(
          (f) => f.toLowerCase() === s.toLowerCase()
        );
        const isActive = flatIndex === activeIndex;
        return (
          <button
            key={`${sectionOf(s)}-${s}`}
            type="button"
            role="option"
            aria-selected={isActive}
            onMouseEnter={() => onHover(flatIndex)}
            onMouseDown={(e) => {
              // Prevent the parent input from blurring before click fires.
              e.preventDefault();
            }}
            onClick={() => onChoose(s)}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
              isActive
                ? "bg-brand-50 text-brand-700"
                : "text-slate-700 hover:bg-slate-50"
            )}
          >
            <span className="truncate">{s}</span>
          </button>
        );
      })}
    </div>
  );
}
