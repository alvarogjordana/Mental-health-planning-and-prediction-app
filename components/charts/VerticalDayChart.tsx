"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface DayPoint {
  day: string;
  score: number;
}

export function VerticalDayChart({ data }: { data: DayPoint[] }) {
  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "#fff",
              border: "1px solid #E2E8F0",
              borderRadius: 8,
              fontSize: 12,
              padding: "6px 10px",
            }}
            itemStyle={{ color: "#0F172A" }}
            labelStyle={{ color: "#94A3B8", fontWeight: 600, marginBottom: 2 }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#1B4FD8"
            strokeWidth={2}
            dot={{ r: 3, fill: "#1B4FD8", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#1B4FD8" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
