"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

interface SparkPoint {
  i: number;
  v: number | null;   // historical value
  f: number | null;   // forecast value (null for historical except connector)
}

/**
 * Tiny sparkline chart. Pass `forecast` to show a dashed projection tail.
 * The last `data` value serves as the connector — it appears in both lines.
 */
export function SparklineChart({
  data,
  forecast,
  color,
}: {
  data: number[];
  forecast?: number[];
  color: string;
}) {
  const hasForecast = forecast && forecast.length > 0;

  // Build a unified series: historical data + optional forecast points.
  // The last historical point is the connector — included in both v and f.
  const points: SparkPoint[] = data.map((v, i) => ({
    i,
    v,
    f: hasForecast && i === data.length - 1 ? v : null, // connector
  }));

  if (hasForecast && forecast) {
    const offset = data.length; // forecast points start after historical
    forecast.forEach((fv, fi) => {
      points.push({ i: offset + fi, v: null, f: fv });
    });
  }

  return (
    <div style={{ width: "100%", height: 48 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          {/* Solid historical line */}
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          {/* Dashed forecast tail */}
          {hasForecast && (
            <Line
              type="monotone"
              dataKey="f"
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              strokeOpacity={0.5}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
