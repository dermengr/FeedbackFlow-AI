"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const COLORS: Record<string, string> = {
  positive: "#10b981",
  neutral: "#64748b",
  negative: "#f43f5e",
};

export function SentimentDonutChart({
  data,
}: {
  data: { sentiment: string; count: number }[];
}) {
  const chartData = (["positive", "neutral", "negative"] as const)
    .map((s) => ({
      name: s,
      count: data.find((d) => d.sentiment === s)?.count ?? 0,
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
