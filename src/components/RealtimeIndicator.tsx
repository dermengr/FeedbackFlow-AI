"use client";

import { useState, useEffect } from "react";
import { Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "feedbackflow-realtime-enabled";

export function useRealtimeEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setEnabled(raw === "true");
    } catch {
      setEnabled(false);
    }
  }, []);

  const toggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return { enabled, toggle };
}

export function RealtimeIndicator() {
  const { enabled, toggle } = useRealtimeEnabled();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "group relative inline-flex items-center justify-center rounded-lg p-1.5 transition-colors",
        enabled
          ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
          : "text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800"
      )}
      aria-label={enabled ? "Disable live updates" : "Enable live updates"}
      title={enabled ? "Live updates on" : "Live updates off"}
    >
      <Radio className="h-4 w-4" />
      <span
        className={cn(
          "absolute right-1 top-1 h-2 w-2 rounded-full",
          enabled
            ? "bg-emerald-500 animate-pulse"
            : "bg-slate-300 dark:bg-slate-600"
        )}
      />
    </button>
  );
}
