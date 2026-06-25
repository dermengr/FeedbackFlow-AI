"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { SENTIMENTS, FEEDBACK_STATUSES, TOPIC_TAXONOMY } from "@/lib/types";

interface Props {
  topicOptions?: string[];
}

export function Filters({ topicOptions }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string, multi: boolean) => {
      const sp = new URLSearchParams(params.toString());
      if (multi) {
        const all = sp.getAll(key);
        const next = all.includes(value)
          ? all.filter((v) => v !== value)
          : [...all, value];
        sp.delete(key);
        next.forEach((v) => sp.append(key, v));
      } else {
        if (value) sp.set(key, value);
        else sp.delete(key);
      }
      // reset to page 1 on filter change
      sp.delete("page");
      router.push(`/inbox?${sp.toString()}`);
    },
    [params, router]
  );

  const isActiveMulti = (key: string, value: string) =>
    params.getAll(key).includes(value);

  const topics = topicOptions ?? [...TOPIC_TAXONOMY];

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sentiment
        </span>
        {SENTIMENTS.map((s) => (
          <Toggle
            key={s}
            active={isActiveMulti("sentiment", s)}
            onClick={() => update("sentiment", s, true)}
            label={s}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Severity ≥
        </span>
        {[1, 2, 3, 4, 5].map((n) => (
          <Toggle
            key={n}
            active={params.get("severity") === String(n)}
            onClick={() =>
              update("severity", params.get("severity") === String(n) ? "" : String(n), false)
            }
            label={`S${n}`}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Status
        </span>
        {FEEDBACK_STATUSES.map((s) => (
          <Toggle
            key={s}
            active={isActiveMulti("status", s)}
            onClick={() => update("status", s, true)}
            label={s.toLowerCase()}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Topic
        </span>
        {topics.map((t) => (
          <Toggle
            key={t}
            active={isActiveMulti("topic", t)}
            onClick={() => update("topic", t, true)}
            label={t}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sort
        </span>
        {[
          { v: "originalTimestamp", l: "Date" },
          { v: "severity", l: "Severity" },
          { v: "createdAt", l: "Ingested" },
        ].map((o) => (
          <Toggle
            key={o.v}
            active={params.get("sort") === o.v || (!params.get("sort") && o.v === "originalTimestamp")}
            onClick={() => update("sort", o.v, false)}
            label={o.l}
          />
        ))}
        <span className="text-slate-300">|</span>
        <Toggle
          active={params.get("order") === "asc"}
          onClick={() =>
            update("order", params.get("order") === "asc" ? "desc" : "asc", false)
          }
          label={params.get("order") === "asc" ? "Asc" : "Desc"}
        />
      </div>

      {params.toString() && (
        <button
          onClick={() => router.push("/inbox")}
          className="text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }`}
    >
      {label}
    </button>
  );
}
