"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { showToast } from "@/lib/toast";

interface UserWithRoles {
  id: string;
  email: string;
  name: string | null;
  roles: string[];
}

interface RoleItem {
  id: string;
  name: string;
  description: string | null;
}

interface RoleManagerProps {
  users: UserWithRoles[];
  roles: RoleItem[];
  allRoleNames: string[];
}

export function RoleManager({ users, roles, allRoleNames }: RoleManagerProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function assignRole(userId: string, roleName: string) {
    setLoading(`${userId}-${roleName}`);
    try {
      const res = await fetch("/api/admin/roles/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to assign role", "error");
      } else {
        showToast(`Assigned ${roleName}`, "success");
        router.refresh();
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  async function removeRole(userId: string, roleName: string) {
    setLoading(`${userId}-${roleName}-remove`);
    try {
      const res = await fetch("/api/admin/roles/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, roleName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to remove role", "error");
      } else {
        showToast(`Removed ${roleName}`, "success");
        router.refresh();
      }
    } catch {
      showToast("Network error", "error");
    } finally {
      setLoading(null);
    }
  }

  const roleMap = new Map(roles.map((r) => [r.name, r]));

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">User</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Current Roles</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-900">{user.name || user.email}</div>
                  <div className="text-xs text-slate-500">{user.email}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {user.roles.length === 0 && (
                      <span className="text-xs text-slate-400">No roles</span>
                    )}
                    {user.roles.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700"
                      >
                        {role}
                        <button
                          type="button"
                          onClick={() => removeRole(user.id, role)}
                          disabled={!!loading}
                          className="ml-0.5 text-brand-500 hover:text-brand-800"
                          title="Remove role"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {allRoleNames
                      .filter((r) => !user.roles.includes(r))
                      .map((roleName) => (
                        <button
                          key={roleName}
                          type="button"
                          onClick={() => assignRole(user.id, roleName)}
                          disabled={!!loading}
                          className={cn(
                            "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                            loading === `${user.id}-${roleName}`
                              ? "border-slate-200 bg-slate-50 text-slate-400"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          )}
                        >
                          + {roleName}
                        </button>
                      ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Role Definitions</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {allRoleNames.map((roleName) => {
            const role = roleMap.get(roleName);
            return (
              <div key={roleName} className="rounded-md border border-slate-100 p-3">
                <div className="font-medium text-slate-900">{roleName}</div>
                <div className="text-xs text-slate-500">
                  {role?.description || "Standard role"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
