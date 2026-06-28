"use client";

import { useEffect, useMemo, useState } from "react";
import { FEEDBACK_STATUSES } from "@/lib/types";
import { showToast } from "@/lib/toast";
import { Archive, Clock, Tag, Trash2, User, X, AlertTriangle } from "lucide-react";

interface UserOption {
  id: string;
  name: string | null;
  email: string | null;
}

interface LabelOption {
  id: string;
  name: string;
  color: string;
}

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onDone: () => void;
}

export function BulkActionBar({
  selectedIds,
  onClear,
  onDone,
}: BulkActionBarProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);

  const [assignValue, setAssignValue] = useState("");
  const [labelValue, setLabelValue] = useState("");
  const [labelMode, setLabelMode] = useState<"add" | "remove">("add");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);

  const count = selectedIds.length;

  useEffect(() => {
    setError(null);
  }, [selectedIds]);

  useEffect(() => {
    let active = true;
    setLoadingResources(true);
    Promise.all([
      fetch("/api/users", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { users: [] }))
        .catch(() => ({ users: [] })),
      fetch("/api/labels", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { labels: [] }))
        .catch(() => ({ labels: [] })),
    ])
      .then(([usersData, labelsData]) => {
        if (!active) return;
        setUsers((usersData.users ?? []) as UserOption[]);
        const fetchedLabels = Array.isArray(labelsData)
          ? labelsData
          : (labelsData.labels ?? []);
        setLabels((fetchedLabels as LabelOption[]).sort((a, b) =>
          a.name.localeCompare(b.name)
        ));
      })
      .catch(() => {
        if (active) {
          setError("Failed to load users or labels");
        }
      })
      .finally(() => {
        if (active) setLoadingResources(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function runAction(
    action:
      | "status"
      | "assign"
      | "label"
      | "unlabel"
      | "delete"
      | "archive"
      | "unarchive"
      | "snooze"
      | "unsnooze",
    value: string
  ) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, action, value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Bulk action failed" }));
        const message = data.error ?? "Failed to apply bulk update";
        setError(message);
        showToast(message, "error");
        return;
      }
      const result = (await res.json()) as { affected: number; errors: Array<{ id: string; error: string }> };
      const failed = result.errors?.length ?? 0;
      if (failed > 0) {
        const summary = `Bulk update applied to ${result.affected} item${result.affected === 1 ? "" : "s"}, ${failed} failed`;
        showToast(summary, "warning");
      } else {
        showToast("Bulk update applied", "success");
      }
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to apply bulk update";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
      setConfirmArchive(false);
      setArchiveReason("");
      setShowCustomSnooze(false);
      setCustomSnoozeDate("");
    }
  }

  const snoozePresets = useMemo(
    () => [
      { label: "1 day", days: 1 },
      { label: "3 days", days: 3 },
      { label: "1 week", days: 7 },
    ],
    []
  );

  function handleSnoozePreset(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    runAction("snooze", d.toISOString());
  }

  function handleCustomSnooze() {
    if (!customSnoozeDate) return;
    const d = new Date(`${customSnoozeDate}T23:59:59`);
    if (Number.isNaN(d.getTime())) return;
    runAction("snooze", d.toISOString());
  }

  if (count === 0) return null;

  const baseBtn =
    "inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
  const secondaryBtn =
    "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600";
  const dangerBtn =
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-700 dark:hover:bg-rose-600";
  const primaryBtn =
    "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-700 dark:hover:bg-brand-600";
  const inputBase =
    "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand-500 focus:outline-none disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200";

  return (
    <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-soft backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/95">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
          {count} {count === 1 ? "item" : "items"} selected
        </span>

        {/* Status */}
        <div className="flex items-center gap-1">
          {FEEDBACK_STATUSES.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => runAction("status", s)}
              className={`${baseBtn} ${secondaryBtn}`}
              title={`Set status ${s.toLowerCase()}`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Assign */}
        <div className="flex items-center gap-1">
          <User className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <select
            value={assignValue}
            disabled={busy || loadingResources}
            onChange={(e) => setAssignValue(e.target.value)}
            className={inputBase}
          >
            <option value="">Assign…</option>
            <option value="__unassigned__">Unassigned</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email ?? u.id}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !assignValue}
            onClick={() => {
              const value = assignValue === "__unassigned__" ? "" : assignValue;
              runAction("assign", value);
              setAssignValue("");
            }}
            className={`${baseBtn} ${secondaryBtn}`}
          >
            Assign
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Labels */}
        <div className="flex items-center gap-1">
          <Tag className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <select
            value={labelMode}
            disabled={busy}
            onChange={(e) => setLabelMode(e.target.value as "add" | "remove")}
            className={inputBase}
          >
            <option value="add">Add</option>
            <option value="remove">Remove</option>
          </select>
          <select
            value={labelValue}
            disabled={busy || loadingResources}
            onChange={(e) => setLabelValue(e.target.value)}
            className={inputBase}
          >
            <option value="">Label…</option>
            {labels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            disabled={busy || !labelValue}
            onClick={() => {
              runAction(labelMode === "add" ? "label" : "unlabel", labelValue);
              setLabelValue("");
            }}
            className={`${baseBtn} ${secondaryBtn}`}
          >
            {labelMode === "add" ? "Add" : "Remove"}
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Snooze */}
        <div className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          {snoozePresets.map((p) => (
            <button
              key={p.label}
              disabled={busy}
              onClick={() => handleSnoozePreset(p.days)}
              className={`${baseBtn} ${secondaryBtn}`}
            >
              {p.label}
            </button>
          ))}
          <button
            disabled={busy}
            onClick={() => setShowCustomSnooze((v) => !v)}
            className={`${baseBtn} ${secondaryBtn}`}
          >
            Custom
          </button>
          <button
            disabled={busy}
            onClick={() => runAction("unsnooze", "")}
            className={`${baseBtn} ${secondaryBtn}`}
            title="Unsnooze selected"
          >
            Unsnooze
          </button>
          {showCustomSnooze && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customSnoozeDate}
                disabled={busy}
                onChange={(e) => setCustomSnoozeDate(e.target.value)}
                className={inputBase}
              />
              <button
                disabled={busy || !customSnoozeDate}
                onClick={handleCustomSnooze}
                className={`${baseBtn} ${primaryBtn}`}
              >
                Snooze
              </button>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Archive */}
        {confirmArchive ? (
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            <input
              type="text"
              value={archiveReason}
              disabled={busy}
              onChange={(e) => setArchiveReason(e.target.value)}
              placeholder="Reason (optional)"
              className={`${inputBase} w-32`}
            />
            <button
              disabled={busy}
              onClick={() => {
                runAction("archive", archiveReason.trim());
              }}
              className={`${baseBtn} ${dangerBtn}`}
            >
              Archive
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setConfirmArchive(false);
                setArchiveReason("");
              }}
              className={`${baseBtn} ${secondaryBtn}`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              disabled={busy}
              onClick={() => runAction("unarchive", "")}
              className={`${baseBtn} ${secondaryBtn}`}
              title="Unarchive selected"
            >
              <Archive className="h-3.5 w-3.5" />
              Unarchive
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
              className={`${baseBtn} ${secondaryBtn}`}
              title="Archive selected"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          </div>
        )}

        <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

        {/* Delete */}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
              Delete {count} items?
            </span>
            <button
              disabled={busy}
              onClick={() => runAction("delete", "")}
              className={`${baseBtn} ${dangerBtn}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Confirm
            </button>
            <button
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
              className={`${baseBtn} ${secondaryBtn}`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className={`${baseBtn} ${dangerBtn}`}
            title="Delete selected"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        )}

        <button
          disabled={busy}
          onClick={onClear}
          className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-60 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <X className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}
