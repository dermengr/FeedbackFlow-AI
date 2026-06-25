"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/utils";
import type { AuditEventDto, AuditType } from "@/lib/audit";

const TYPE_LABELS: Record<AuditType, string> = {
  STATUS_CHANGE: "Status changed",
  ASSIGN: "Assigned",
  UNASSIGN: "Unassigned",
  COMMENT: "Commented",
  LABEL_ADD: "Label added",
  LABEL_REMOVE: "Label removed",
  SNOOZE: "Snoozed",
  UNSNOOZE: "Unsnoozed",
  BULK_UPDATE: "Bulk updated",
};

const TYPE_BADGE: Record<AuditType, string> = {
  STATUS_CHANGE: "bg-blue-100 text-blue-700",
  ASSIGN: "bg-green-100 text-green-700",
  UNASSIGN: "bg-gray-100 text-gray-700",
  COMMENT: "bg-purple-100 text-purple-700",
  LABEL_ADD: "bg-indigo-100 text-indigo-700",
  LABEL_REMOVE: "bg-orange-100 text-orange-700",
  SNOOZE: "bg-yellow-100 text-yellow-700",
  UNSNOOZE: "bg-teal-100 text-teal-700",
  BULK_UPDATE: "bg-pink-100 text-pink-700",
};

function metaDescription(
  type: AuditType,
  meta: Record<string, unknown> | null
): string | null {
  if (!meta) return null;
  switch (type) {
    case "STATUS_CHANGE": {
      const from = meta.from;
      const to = meta.to;
      if (from && to) return `${from} → ${to}`;
      return null;
    }
    case "ASSIGN":
    case "UNASSIGN":
      return typeof meta.assignee === "string" ? meta.assignee : null;
    case "COMMENT":
      return typeof meta.text === "string" ? meta.text : null;
    case "LABEL_ADD":
    case "LABEL_REMOVE":
      return typeof meta.label === "string" ? meta.label : null;
    case "SNOOZE":
    case "UNSNOOZE":
      return typeof meta.until === "string" ? `until ${formatDate(meta.until)}` : null;
    case "BULK_UPDATE":
      return typeof meta.count === "number" ? `${meta.count} items` : null;
    default:
      return null;
  }
}

export function ActivityTab({ feedbackItemId }: { feedbackItemId: string }) {
  const [events, setEvents] = useState<AuditEventDto[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/feedback/${feedbackItemId}/activity`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as { events: AuditEventDto[] };
        if (active) {
          setEvents(data.events);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
          setEvents([]);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [feedbackItemId]);

  if (loading) {
    return (
      <div className="py-6 text-sm text-gray-500">Loading activity…</div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-sm text-red-600">{error}</div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="py-6 text-sm text-gray-500">No activity yet</div>
    );
  }

  return (
    <ol className="relative border-l border-gray-200 pl-6 space-y-3">
      {events.map((event) => {
        const label = TYPE_LABELS[event.type] ?? event.type;
        const badge = TYPE_BADGE[event.type] ?? "bg-gray-100 text-gray-700";
        const detail = metaDescription(event.type, event.meta);
        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-[1.625rem] mt-1 h-3 w-3 rounded-full ring-2 ring-white ${
                badge.split(" ")[0]
              }`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
              >
                {label}
              </span>
              <span className="text-sm font-medium text-gray-900">
                {event.actor.name ?? event.actor.email}
              </span>
              <time
                dateTime={event.createdAt}
                className="text-xs text-gray-500"
              >
                {formatDate(event.createdAt)}
              </time>
            </div>
            {detail && (
              <p className="mt-1 text-sm text-gray-600">{detail}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
