import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listRoutingRules } from "@/lib/routing";
import type { RoutingConditions } from "@/lib/routing";
import { RoutingRuleForm } from "@/components/RoutingRuleForm";
import { EnabledToggle } from "@/components/RoutingRuleActions";

export const dynamic = "force-dynamic";

export default async function RoutingRulesPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  const [rules, users] = await Promise.all([
    listRoutingRules(),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Routing Rules</h1>
        <p className="text-sm text-slate-500">
          Auto-assign incoming feedback to the right person based on
          sentiment, topics, and severity.
        </p>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No routing rules configured. Create a rule to start auto-assigning
          feedback.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Conditions</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Enabled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {rule.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <ConditionBadges conditions={rule.conditions} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {rule.assignee?.name ?? rule.assignee?.email ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{rule.priority}</td>
                  <td className="px-4 py-3">
                    <EnabledToggle ruleId={rule.id} enabled={rule.enabled} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RoutingRuleForm users={users} />
    </div>
  );
}

function ConditionBadges({
  conditions,
}: {
  conditions: RoutingConditions;
}) {
  const parts: string[] = [];
  if (conditions.topics && conditions.topics.length > 0) {
    parts.push(`topics: ${conditions.topics.join(", ")}`);
  }
  if (conditions.minSeverity !== undefined) {
    parts.push(`severity ≥ ${conditions.minSeverity}`);
  }
  if (conditions.sentiment !== undefined) {
    parts.push(`sentiment: ${conditions.sentiment}`);
  }

  if (parts.length === 0) {
    return <span className="text-slate-400">Any feedback</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((p) => (
        <span
          key={p}
          className="rounded bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700"
        >
          {p}
        </span>
      ))}
    </div>
  );
}