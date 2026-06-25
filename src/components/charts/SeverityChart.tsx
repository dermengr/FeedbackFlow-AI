"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface Datum {
  severity: number;
  count: number;
}

const COLORS: Record<number, string> = {
  1: "#94a3b8",
  2: "#38bdf8",
  3: "#f59e0b",
  4: "#fb923c",
  5: "#f43f5e",
};

export function SeverityChart({ data }: { data: Datum[] }) {
  // Ensure all severities 1-5 are represented.
  const full = [1, 2, 3, 4, 5].map((s) => {
    const found = data.find((d) => d.severity === s);
    return { severity: s, count: found?.count ?? 0 };
  });
  const chartData = full.map((d) => ({
    name: `S${d.severity}`,
    ...d,
  }));

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
            <Cell key={entry.severity} fill={COLORS[entry.severity]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
