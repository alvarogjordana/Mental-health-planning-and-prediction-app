"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { TrendDataPoint } from "@/lib/mock-dashboard";

/* ─── Per-vertical line config ─── */
const VERTICAL_LINES: { key: keyof TrendDataPoint; label: string; color: string }[] = [
  { key: "health",   label: "Health",    color: "#16A34A" },
  { key: "workLife", label: "Work-Life", color: "#2563EB" },
  { key: "social",   label: "Social",    color: "#9333EA" },
  { key: "purpose",  label: "Purpose",   color: "#EA580C" },
  { key: "sleep",    label: "Sleep",     color: "#0891B2" },
];

/* ─── Chart data point: historical keys + forecast (F-suffix) keys ─── */
type ChartPoint = {
  date: string;
  // Historical — null on forecast days (except the connector)
  overall: number | null;
  health: number | null;
  workLife: number | null;
  social: number | null;
  purpose: number | null;
  sleep: number | null;
  // Forecast — null on historical days (except the connector)
  overallF: number | null;
  healthF: number | null;
  workLifeF: number | null;
  socialF: number | null;
  purposeF: number | null;
  sleepF: number | null;
};

const NUMERIC_KEYS = ["overall", "health", "workLife", "social", "purpose", "sleep"] as const;
type NumericKey = typeof NUMERIC_KEYS[number];

/** Build the split chart data array from TrendDataPoint[]. */
function buildChartData(data: TrendDataPoint[]): { points: ChartPoint[]; todayLabel: string } {
  // Find the last historical day ("today" connector)
  const lastHistIdx = data.reduce(
    (acc, d, i) => (!d.isForecast ? i : acc),
    0
  );
  const todayLabel = data[lastHistIdx].date;

  const points: ChartPoint[] = data.map((d, i) => {
    const isConnector = i === lastHistIdx;

    const hist: Partial<Record<NumericKey, number | null>> = {};
    const fore: Partial<Record<`${NumericKey}F`, number | null>> = {};

    for (const key of NUMERIC_KEYS) {
      hist[key] = !d.isForecast ? d[key] : null;
      (fore as Record<string, number | null>)[`${key}F`] =
        d.isForecast || isConnector ? d[key] : null;
    }

    return { date: d.date, ...hist, ...fore } as ChartPoint;
  });

  return { points, todayLabel };
}

/* ─── Custom tooltip ─── */
interface TooltipEntry {
  dataKey: string;
  name: string;
  value: number | null;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  // Show only non-null, non-F-suffix entries
  const entries = payload.filter(
    (p) => p.value !== null && p.value !== undefined && !String(p.dataKey).endsWith("F")
  );
  if (!entries.length) return null;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #E2E8F0",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
      }}
    >
      <p style={{ color: "#94A3B8", fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {entries.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {Math.round(entry.value as number)}
        </div>
      ))}
    </div>
  );
}

/* ─── Component ─── */
export function TrendsChart({ data }: { data: TrendDataPoint[] }) {
  const [showAll, setShowAll] = useState(true);
  const { points, todayLabel } = buildChartData(data);

  return (
    <div>
      {/* Toggle */}
      <div className="mb-4 flex gap-2">
        {(["All verticals", "Overall only"] as const).map((label) => {
          const active = label === "All verticals" ? showAll : !showAll;
          return (
            <button
              key={label}
              onClick={() => setShowAll(label === "All verticals")}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                backgroundColor: active ? "#0F172A" : "#F1F5F9",
                color: active ? "#fff" : "#475569",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 16, right: 8, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#94A3B8" }}
              axisLine={false}
              tickLine={false}
              ticks={[0, 25, 50, 75, 100]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* "Today" reference line */}
            <ReferenceLine
              x={todayLabel}
              stroke="#CBD5E1"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: "Today",
                position: "insideTopLeft",
                fontSize: 10,
                fill: "#94A3B8",
                offset: 4,
              }}
            />

            {showAll && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                iconType="plainline"
                iconSize={16}
              />
            )}

            {/* ── Overall — always visible ── */}
            {/* Solid historical */}
            <Line
              type="monotone"
              dataKey="overall"
              name="Overall"
              stroke="#0F172A"
              strokeWidth={showAll ? 2.5 : 2}
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            {/* Dashed forecast */}
            <Line
              type="monotone"
              dataKey="overallF"
              name="Overall"
              stroke="#0F172A"
              strokeWidth={showAll ? 2.5 : 2}
              strokeDasharray="5 5"
              strokeOpacity={0.5}
              dot={false}
              activeDot={false}
              legendType="none"
              connectNulls={false}
            />

            {/* ── Per-vertical lines — "All verticals" mode only ── */}
            {showAll &&
              VERTICAL_LINES.map(({ key, label, color }) => (
                [
                  // Solid historical line
                  <Line
                    key={`${key}-hist`}
                    type="monotone"
                    dataKey={key as string}
                    name={label}
                    stroke={color}
                    strokeWidth={1.5}
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls={false}
                  />,
                  // Dashed forecast line
                  <Line
                    key={`${key}F`}
                    type="monotone"
                    dataKey={`${key}F`}
                    name={label}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    connectNulls={false}
                  />,
                ]
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Legend note */}
      <p className="mt-3 text-center text-[11px]" style={{ color: "#94A3B8" }}>
        <span style={{ borderBottom: "2px solid #94A3B8", paddingBottom: 1 }}>——</span>
        &nbsp;Actual&nbsp;&nbsp;
        <span style={{ borderBottom: "2px dashed #94A3B8", paddingBottom: 1 }}>– –</span>
        &nbsp;Forecast
      </p>
    </div>
  );
}
