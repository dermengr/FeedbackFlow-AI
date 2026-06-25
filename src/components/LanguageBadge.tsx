"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export function LanguageBadge({
  language,
  translatedSummary,
}: {
  language: string | null;
  translatedSummary: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!language) return null;

  return (
    <div className="space-y-1">
      <span
        className={cn(
          "inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium uppercase text-sky-700 ring-1 ring-inset ring-sky-600/20"
        )}
      >
        {language}
      </span>

      {translatedSummary ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-sky-600 hover:text-sky-700 focus:outline-none"
          >
            {open ? "Hide English translation" : "Show English translation"}
          </button>
          {open ? (
            <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              {translatedSummary}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
