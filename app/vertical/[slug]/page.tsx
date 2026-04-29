import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";
import { WellbeingVertical } from "@/types";
import { getMockDashboardData } from "@/lib/mock-dashboard";
import { getOrGenerateAssessment } from "@/lib/ai";
import { VERTICAL_INSIGHTS } from "@/lib/vertical-insights";
import { VerticalDayChart } from "@/components/charts/VerticalDayChart";

/* ─── Slug ↔ vertical mapping ─── */
const SLUG_TO_VERTICAL: Record<string, WellbeingVertical> = {
  "health-fitness":    WellbeingVertical.HEALTH,
  "work-life":         WellbeingVertical.WORK_LIFE,
  "social-connection": WellbeingVertical.SOCIAL,
  "sense-of-purpose":  WellbeingVertical.PURPOSE,
  "sleep-energy":      WellbeingVertical.SLEEP,
};

const VERTICAL_CONFIG: Record<WellbeingVertical, { label: string; icon: string }> = {
  [WellbeingVertical.HEALTH]:    { label: "Health & Fitness",  icon: "🏃" },
  [WellbeingVertical.WORK_LIFE]: { label: "Work-Life Balance", icon: "⚖️" },
  [WellbeingVertical.SOCIAL]:    { label: "Social Connection", icon: "🤝" },
  [WellbeingVertical.PURPOSE]:   { label: "Sense of Purpose",  icon: "🧭" },
  [WellbeingVertical.SLEEP]:     { label: "Sleep & Energy",    icon: "🌙" },
};

/* ─── Design tokens ─── */
const PRIMARY = "#1B4FD8";
const TEXT    = "#0F172A";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8F0";
const GREEN   = "#16A34A";
const RED     = "#DC2626";

export default async function VerticalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const vertical = SLUG_TO_VERTICAL[slug];
  if (!vertical) notFound();

  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  const weights: Record<string, number> = user.verticalWeights
    ? JSON.parse(user.verticalWeights)
    : Object.fromEntries(Object.values(WellbeingVertical).map((v) => [v, 0.2]));

  const { verticalScores } = getMockDashboardData(user.id);
  const vs = verticalScores.find((v) => v.vertical === vertical)!;
  const config = VERTICAL_CONFIG[vertical];
  const weight = weights[vertical] ?? 0.2;

  /* ── Computed stats ── */
  const avg7  = Math.round(vs.trendDays.reduce((a, b) => a + b, 0) / vs.trendDays.length);
  const best7  = Math.max(...vs.trendDays);
  const worst7 = Math.min(...vs.trendDays);

  /* ── Chart data: pair trendDays with short day labels ── */
  const today = new Date();
  const chartData = vs.trendDays.map((score, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString("en-US", { weekday: "short" }), score };
  });

  /* ── AI insight for this vertical ── */
  const assessment = await getOrGenerateAssessment(user.id);
  const aiInsight = assessment.verticalInsights.find(
    (vi) => vi.vertical === vertical
  )?.insight;

  /* ── Trend badge colours ── */
  const trendColor = vs.trend > 0 ? GREEN : vs.trend < 0 ? RED : MUTED;
  const trendArrow = vs.trend > 0 ? "↑" : vs.trend < 0 ? "↓" : "→";
  const trendSign  = vs.trend > 0 ? "+" : "";

  /* ── Mock driving insights ── */
  const drivingInsights = VERTICAL_INSIGHTS[vertical as string] ?? [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">

      <Header backHref="/" pageLabel="Vertical" />

      <main className="mx-auto max-w-[680px] px-6 pt-8">

        {/* ── 1. Hero header ── */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-3xl leading-none">{config.icon}</p>
              <h1 className="mt-2 text-2xl font-bold" style={{ color: TEXT }}>
                {config.label}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-6xl font-bold leading-none tabular-nums" style={{ color: TEXT }}>
                {vs.score}
              </div>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>/ 100</p>
            </div>
          </div>

          {/* Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: trendColor + "18", color: trendColor }}
            >
              {trendArrow} {trendSign}{vs.trend} from last week
            </span>
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: "#F1F5F9", color: MUTED }}
            >
              {Math.round(weight * 100)}% of your wellbeing score
            </span>
          </div>
        </div>

        {/* ── 2. 7-day chart ── */}
        <div className="mb-4 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3
            className="mb-4 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Last 7 days
          </h3>
          <VerticalDayChart data={chartData} />
        </div>

        {/* ── 3. What's shaping this ── */}
        <div className="mb-4 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3
            className="mb-4 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            What&apos;s shaping this
          </h3>
          <ul className="flex flex-col gap-3">
            {drivingInsights.map((text, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: PRIMARY }}
                />
                <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
                  {text}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* ── 4. AI insight ── */}
        <div
          className="mb-4 rounded-xl p-5"
          style={{ backgroundColor: "#F8FAFC", border: `1px solid ${BORDER}` }}
        >
          <p
            className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: MUTED }}
          >
            Freedom&apos;s take
          </p>
          {aiInsight ? (
            <p className="text-sm italic leading-relaxed" style={{ color: "#475569" }}>
              &ldquo;{aiInsight}&rdquo;
            </p>
          ) : (
            <p className="text-sm" style={{ color: MUTED }}>
              Complete your first week of check-ins to unlock AI insights.
            </p>
          )}
        </div>

        {/* ── 5. Historical stat pills ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "7-day avg", value: avg7  },
            { label: "Best day",  value: best7  },
            { label: "Worst day", value: worst7 },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-white p-4 text-center"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <div className="text-2xl font-bold tabular-nums" style={{ color: TEXT }}>
                {value}
              </div>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>
                {label}
              </p>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}
