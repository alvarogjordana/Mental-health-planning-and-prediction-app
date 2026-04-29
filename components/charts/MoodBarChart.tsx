"use client";

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface MoodPoint {
  date: string;
  score: number;
  mood: string;
  driver: string;
  reflection: string;
}

function barColor(score: number): string {
  if (score >= 80) return "#16A34A";
  if (score >= 60) return "#2563EB";
  if (score >= 40) return "#F59E0B";
  return "#DC2626";
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: MoodPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        maxWidth: 220,
      }}
    >
      <p style={{ fontWeight: 600, color: "#94A3B8", marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#0F172A" }}>
        {d.mood} · {d.score}/100
      </p>
      {d.driver && (
        <p style={{ color: "#64748B", marginTop: 2 }}>Driver: {d.driver}</p>
      )}
      {d.reflection && (
        <p style={{ color: "#94A3B8", fontStyle: "italic", marginTop: 2 }}>
          &ldquo;{d.reflection.length > 70 ? d.reflection.slice(0, 70) + "…" : d.reflection}&rdquo;
        </p>
      )}
    </div>
  );
}

export function MoodBarChart({ data }: { data: MoodPoint[] }) {
  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            axisLine={false}
            tickLine={false}
            ticks={[0, 25, 50, 75, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="score" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.score)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
