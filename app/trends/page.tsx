export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { prisma } from "@/lib/db";
import { HelpBubble } from "@/components/HelpBubble";
import { WellbeingVertical } from "@/types";
import { getMockTrendData, type TrendDataPoint } from "@/lib/mock-dashboard";
import { getOrGenerateAssessment } from "@/lib/ai";
import { TrendsChart } from "@/components/charts/TrendsChart";
import { SparklineChart } from "@/components/charts/SparklineChart";

/* ─── Design tokens ─── */
const PRIMARY = "#1B4FD8";
const TEXT    = "#0F172A";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8F0";
const GREEN   = "#16A34A";
const RED     = "#DC2626";

/* ─── Vertical display config ─── */
interface VerticalMeta {
  label: string;
  icon: string;
  color: string;
  dataKey: keyof TrendDataPoint;
}

const VERTICAL_META: VerticalMeta[] = [
  { label: "Health & Fitness",  icon: "🏃", color: "#16A34A", dataKey: "health"   },
  { label: "Work-Life Balance", icon: "⚖️", color: "#2563EB", dataKey: "workLife"  },
  { label: "Social Connection", icon: "🤝", color: "#9333EA", dataKey: "social"    },
  { label: "Sense of Purpose",  icon: "🧭", color: "#EA580C", dataKey: "purpose"   },
  { label: "Sleep & Energy",    icon: "🌙", color: "#0891B2", dataKey: "sleep"     },
];

/* ─── Helpers ─── */
function avg(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

interface TrendStat {
  label: string;
  icon: string;
  color: string;
  dataKey: keyof TrendDataPoint;
  pct: number;           // percentage change (week 1 → week 2, historical only)
  last7: number[];       // last 7 historical values for sparkline
  forecast7: number[];   // 7 forecast values for sparkline dashed tail
  isUp: boolean;
  isDown: boolean;
}

function computeVerticalTrends(data: TrendDataPoint[]): TrendStat[] {
  // Only use historical data for trend/sparkline computation
  const historical = data.filter((d) => !d.isForecast);
  const forecast   = data.filter((d) => d.isForecast);
  const first7 = historical.slice(0, 7);
  const last7   = historical.slice(7);

  return VERTICAL_META.map((meta) => {
    const f7avg  = avg(first7.map((d) => d[meta.dataKey] as number));
    const l7avg  = avg(last7.map((d) => d[meta.dataKey] as number));
    const pct    = Math.round(((l7avg - f7avg) / f7avg) * 100);
    const isUp   = pct > 1;
    const isDown = pct < -1;
    return {
      ...meta,
      pct,
      last7:     last7.map((d) => d[meta.dataKey] as number),
      forecast7: forecast.map((d) => d[meta.dataKey] as number),
      isUp,
      isDown,
    };
  });
}

interface ForecastPill {
  condition: string;
  outcome: string;
  color: string;
  bg: string;
}

function computeForecastPills(data: TrendDataPoint[]): ForecastPill[] {
  const pills: ForecastPill[] = [];
  const historical = data.filter((d) => !d.isForecast);
  const first7 = historical.slice(0, 7);
  const last7   = historical.slice(7);

  /* Work-Life burnout risk */
  const wlFirst = avg(first7.map((d) => d.workLife));
  const wlLast  = avg(last7.map((d) => d.workLife));
  const wlRate  = Math.round(wlLast - wlFirst);
  if (wlRate <= -3) {
    pills.push({
      condition: `Work-Life continues at ${wlRate}/week`,
      outcome: "Burnout risk in ~2 weeks",
      color: RED,
      bg: "#FEF2F2",
    });
  }

  /* Sleep energy crash */
  const sleepLast7avg = avg(last7.map((d) => d.sleep));
  if (sleepLast7avg < 60) {
    pills.push({
      condition: `Sleep stays below ${Math.round(sleepLast7avg)}`,
      outcome: "Energy crash likely by next weekend",
      color: "#EA580C",
      bg: "#FFF7ED",
    });
  }

  /* Health positive trajectory */
  const healthFirst = avg(first7.map((d) => d.health));
  const healthLast  = avg(last7.map((d) => d.health));
  if (healthLast > healthFirst) {
    const projected = Math.min(100, Math.round(healthLast + (healthLast - healthFirst)));
    pills.push({
      condition: "Health trend holds",
      outcome: `Fitness score could reach ${projected} in 10 days`,
      color: GREEN,
      bg: "#F0FDF4",
    });
  }

  return pills;
}

/* ─── Page ─── */
export default async function TrendsPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  const trendData    = getMockTrendData();
  const assessment   = await getOrGenerateAssessment(user.id);
  const vertStats    = computeVerticalTrends(trendData);
  const forecastPills = computeForecastPills(trendData);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <main className="mx-auto max-w-[680px] px-6 pt-8">

        {/* ── 1. Page title ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold" style={{ color: TEXT }}>
            Trends &amp; Forecast
          </h1>
          <p className="mt-1 text-sm" style={{ color: MUTED }}>
            Last 2 weeks of data + 7-day forecast
          </p>
        </div>

        {/* ── 2. Overall score chart (14 days) ── */}
        <div className="mb-4 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3
            className="mb-4 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Overview &amp; Forecast
          </h3>
          <TrendsChart data={trendData} />
        </div>

        {/* ── 3. Vertical trend cards (2-col grid) ── */}
        <div className="mb-4">
          <h3
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Vertical trends
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {vertStats.map((stat) => {
              const borderColor = stat.isUp ? GREEN : stat.isDown ? RED : BORDER;
              const trendColor  = stat.isUp ? GREEN : stat.isDown ? RED : MUTED;
              const trendArrow  = stat.isUp ? "↑" : stat.isDown ? "↓" : "→";
              const trendLabel  = stat.isUp
                ? `+${stat.pct}% this week`
                : stat.isDown
                ? `${stat.pct}% this week`
                : "Holding steady";

              return (
                <div
                  key={stat.dataKey}
                  className="rounded-xl bg-white p-4"
                  style={{ border: `1.5px solid ${borderColor}` }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-base leading-none">{stat.icon}</span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: trendColor }}
                    >
                      {trendArrow} {trendLabel}
                    </span>
                  </div>
                  <p className="mb-2 text-xs font-medium" style={{ color: TEXT }}>
                    {stat.label}
                  </p>
                  <SparklineChart
                    data={stat.last7}
                    forecast={stat.forecast7}
                    color={stat.color}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. AI Forecast ── */}
        <div className="mb-4 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Where you&apos;re headed
          </h3>
          <p className="mb-5 text-sm leading-relaxed" style={{ color: "#475569" }}>
            {assessment.forecast}
          </p>

          {/* If/then pills */}
          {forecastPills.length > 0 && (
            <div className="flex flex-col gap-2">
              {forecastPills.map((pill, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-lg px-4 py-3"
                  style={{ backgroundColor: pill.bg }}
                >
                  <span className="mt-0.5 shrink-0 text-sm" style={{ color: pill.color }}>
                    ⚠
                  </span>
                  <div>
                    <span className="text-xs font-semibold" style={{ color: pill.color }}>
                      If {pill.condition}:
                    </span>
                    <span className="ml-1 text-xs" style={{ color: TEXT }}>
                      {pill.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 5. Insight callout ── */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: "#EFF6FF", border: `1px solid #BFDBFE` }}
        >
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb size={16} style={{ color: PRIMARY }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: PRIMARY }}>
              Weekly insight
            </span>
          </div>
          <p className="mb-4 text-sm leading-relaxed" style={{ color: "#1E3A8A" }}>
            {assessment.overallNarrative}
          </p>
          <Link
            href="/report"
            className="text-sm font-semibold"
            style={{ color: PRIMARY }}
          >
            See full weekly report →
          </Link>
        </div>

      </main>

      <HelpBubble items={[
        { title: "Trend Lines", description: "Each line shows how one wellbeing vertical has moved over the past 14 days. Computed from your daily check-ins and stored vertical scores." },
        { title: "7-day Forecast", description: "A linear projection: the slope observed over the last 7 historical days is extended 7 days forward. Directional guidance, not a precise prediction." },
        { title: "Vertical Summaries", description: "Shows each vertical's current score, 14-day delta, and a mini sparkline. Clicking a vertical card opens its detail page." },
        { title: "AI Insight", description: "A single-sentence interpretation of the most significant trend in your data, generated by Claude." },
        { title: "Data Source", description: "Trend lines use the VerticalScore table in your database. Each daily check-in produces five vertical scores that feed these charts." },
      ]} />
    </div>
  );
}
