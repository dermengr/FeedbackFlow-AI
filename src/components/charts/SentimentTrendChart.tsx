"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Datum {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export function SentimentTrendChart({ data }: { data: Datum[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => d.slice(5)}
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="neutral" stroke="#64748b" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="negative" stroke="#f43f5e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
