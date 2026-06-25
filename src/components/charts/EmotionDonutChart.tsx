"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { EMOTIONS } from "@/lib/types";

const COLORS: Record<string, string> = {
  angry: "#f43f5e",
  frustrated: "#ef4444",
  confused: "#f59e0b",
  disappointed: "#fbbf24",
  neutral: "#64748b",
  happy: "#10b981",
  excited: "#22c55e",
};

export function EmotionDonutChart({
  data,
}: {
  data: { emotion: string; count: number }[];
}) {
  const chartData = ([...EMOTIONS] as const)
    .map((e) => ({
      name: e,
      count: data.find((d) => d.emotion === e)?.count ?? 0,
    }))
    .filter((d) => d.count > 0);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">
        No data yet
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="count"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          innerRadius={45}
          paddingAngle={2}
        >
          {chartData.map((entry) => (
            <Cell key={entry.name} fill={COLORS[entry.name] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
