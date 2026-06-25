"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

interface Datum {
  topic: string;
  count: number;
}

export function TopicDistributionChart({ data }: { data: Datum[] }) {
  const chartData = data.slice(0, 8);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
        <YAxis
          type="category"
          dataKey="topic"
          width={110}
          tick={{ fontSize: 11, fill: "#475569" }}
        />
        <Tooltip />
        <Bar dataKey="count" fill="#1c6ef5" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
