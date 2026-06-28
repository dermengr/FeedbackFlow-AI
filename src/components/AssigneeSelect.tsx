"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { showToast } from "@/lib/toast";

type User = { id: string; name: string | null; email: string | null };

export function AssigneeSelect({
  feedbackItemId,
  currentAssigneeId,
}: {
  feedbackItemId: string;
  currentAssigneeId: string | null;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<string>(currentAssigneeId ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load users");
        const data = (await res.json()) as { users: User[] };
        if (active) setUsers(data.users);
      } catch (err) {
        if (active) {
          setError("Failed to load users");
          showToast(err instanceof Error ? err.message : "Failed to load users", "error");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleChange(next: string) {
    const assignedToId = next === "" ? null : next;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/feedback/${feedbackItemId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Update failed" }));
      const message = data.error ?? "Failed to assign";
      setError(message);
      showToast(message, "error");
      // revert selection on failure
      setSelected(currentAssigneeId ?? "");
      return;
    }
    setSelected(next);
    router.refresh();
    showToast("Assigned", "success");
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-2">
        <select
          disabled
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-400"
        >
          <option>Loading…</option>
        </select>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <select
        value={selected}
        disabled={saving}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name ?? u.email ?? u.id}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}
