export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WellbeingVertical } from "@/types";
import { getMockDashboardData, type VerticalScoreData } from "@/lib/mock-dashboard";
import { getWeatherData, computeWeatherModifiers } from "@/lib/integrations/weather";
import { getCalendarData, computeCalendarScore, type CalendarData } from "@/lib/integrations/calendar";
import { HelpBubble } from "@/components/HelpBubble";

/* ─── Vertical → URL slug ─── */
const VERTICAL_SLUG: Record<WellbeingVertical, string> = {
  [WellbeingVertical.HEALTH]:    "health-fitness",
  [WellbeingVertical.WORK_LIFE]: "work-life",
  [WellbeingVertical.SOCIAL]:    "social-connection",
  [WellbeingVertical.PURPOSE]:   "sense-of-purpose",
  [WellbeingVertical.SLEEP]:     "sleep-energy",
};

/* ─── Per-vertical display config ─── */
const VERTICAL_CONFIG: Record<WellbeingVertical, { label: string; icon: string }> = {
  [WellbeingVertical.HEALTH]:    { label: "Health & Fitness",    icon: "🏃" },
  [WellbeingVertical.WORK_LIFE]: { label: "Work-Life Balance",   icon: "⚖️" },
  [WellbeingVertical.SOCIAL]:    { label: "Social Connection",   icon: "🤝" },
  [WellbeingVertical.PURPOSE]:   { label: "Sense of Purpose",    icon: "🧭" },
  [WellbeingVertical.SLEEP]:     { label: "Sleep & Energy",      icon: "🌙" },
};

/* ─── Dashboard (server component) ─── */
export default async function Home() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  const weights: Record<string, number> = user.verticalWeights
    ? JSON.parse(user.verticalWeights)
    : Object.fromEntries(Object.values(WellbeingVertical).map((v) => [v, 0.2]));

  const { verticalScores } = getMockDashboardData(user.id);

  /* Weather — fetched server-side; null on any failure (never blocks render) */
  let weatherData = null;
  try { weatherData = await getWeatherData(user.id); } catch { /* silently skip */ }
  const weatherMods = weatherData ? computeWeatherModifiers(weatherData) : null;

  /* Calendar — real iCal feeds; null on failure; shared cache with AI module */
  let calendarData: CalendarData | null = null;
  try { calendarData = await getCalendarData(); } catch { /* silently skip */ }
  const calendarWorkLifeScore = calendarData ? computeCalendarScore(calendarData) : null;

  /* Build effective vertical scores: replace WORK_LIFE with calendar-derived score */
  const effectiveScores = verticalScores.map(vs => {
    if (vs.vertical === WellbeingVertical.WORK_LIFE && calendarWorkLifeScore !== null) {
      return { ...vs, score: calendarWorkLifeScore };
    }
    return vs;
  });

  /* Map vertical enum → weather modifier delta */
  const weatherDelta = (v: WellbeingVertical): number => {
    if (!weatherMods) return 0;
    if (v === WellbeingVertical.HEALTH)   return weatherMods.health;
    if (v === WellbeingVertical.SOCIAL)   return weatherMods.social;
    if (v === WellbeingVertical.SLEEP)    return weatherMods.sleep;
    if (v === WellbeingVertical.PURPOSE)  return weatherMods.purpose;
    return 0;
  };

  /* Weighted overall (effective scores + weather modifiers) */
  const overallScore = Math.round(
    effectiveScores.reduce((sum, vs) => {
      const modified = Math.max(0, Math.min(100, vs.score + weatherDelta(vs.vertical)));
      return sum + modified * (weights[vs.vertical] ?? 0.2);
    }, 0)
  );
  const lastWeekOverall = Math.round(
    effectiveScores.reduce(
      (sum, vs) => sum + (vs.score - vs.trend) * (weights[vs.vertical] ?? 0.2),
      0
    )
  );
  const overallDiff = overallScore - lastWeekOverall;

  /* Avatar initials */
  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-white pb-16">

      {/* ── Weather strip ── */}
      {weatherData && (
        <div
          className="border-b py-1.5 text-center text-xs"
          style={{ borderColor: "#E2E8F0", color: "#94A3B8", backgroundColor: "#fff" }}
        >
          📍 {weatherData.current.city} · {weatherData.current.tempF}°F ·{" "}
          {weatherData.current.description.charAt(0).toUpperCase() +
            weatherData.current.description.slice(1)}
        </div>
      )}

      {/* ── Today's upcoming events strip ── */}
      {calendarData && (
        <div
          className="border-b px-6 py-2"
          style={{ borderColor: "#E2E8F0", backgroundColor: "#fff" }}
        >
          <div className="mx-auto max-w-[680px]">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#94A3B8" }}>
              Today
            </p>
            {calendarData.summary.upcomingToday.length === 0 ? (
              <p className="text-xs" style={{ color: "#CBD5E1" }}>
                Nothing scheduled for the rest of today
              </p>
            ) : (
              <ul className="flex flex-col gap-0.5">
                {calendarData.summary.upcomingToday.slice(0, 3).map((ev, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs" style={{ color: "#475569" }}>
                    <span className="tabular-nums" style={{ color: "#94A3B8" }}>
                      {ev.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span>—</span>
                    <span className="truncate">{ev.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[680px] px-6">

        {/* ── 2. Overall Wellbeing Score ── */}
        <section className="pb-8 pt-10 text-center">
          <div
            className="text-[72px] font-bold leading-none tracking-tight"
            style={{ color: "#0F172A" }}
          >
            {overallScore}
          </div>
          <p className="mt-2 text-sm font-medium" style={{ color: "#94A3B8" }}>
            Overall wellbeing
          </p>
          <p
            className="mt-2 text-sm"
            style={{
              color:
                overallDiff > 0 ? "#16A34A" : overallDiff < 0 ? "#DC2626" : "#94A3B8",
            }}
          >
            {overallDiff > 0
              ? `↑ Up ${overallDiff} point${overallDiff !== 1 ? "s" : ""} from last week`
              : overallDiff < 0
              ? `↓ Down ${Math.abs(overallDiff)} point${Math.abs(overallDiff) !== 1 ? "s" : ""} from last week`
              : "→ Holding steady from last week"}
          </p>

        </section>

        {/* ── 3. Vertical Score Cards ── */}
        <section className="mb-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {effectiveScores.map((vs) => (
              <Link
                key={vs.vertical}
                href={`/vertical/${VERTICAL_SLUG[vs.vertical]}`}
                className="block transition-opacity hover:opacity-80"
              >
                <VerticalCard vs={vs} weight={weights[vs.vertical] ?? 0.2} />
              </Link>
            ))}
          </div>
        </section>

        {/* Dev: reset profile */}
        <div className="pb-4 text-center">
          <Link
            href="/onboarding"
            className="text-xs transition-colors hover:text-[#94A3B8]"
            style={{ color: "#CBD5E1" }}
          >
            Reset profile (dev)
          </Link>
        </div>
      </main>

      <HelpBubble items={[
        { title: "Overall Score", description: "Weighted average of your 5 wellbeing verticals (0–100). Weights are set by your priority ranking during onboarding." },
        { title: "Vertical Cards", description: "Each card scores one area of your life. Click any card to see historical detail. Blue left border = higher priority vertical." },
        { title: "Weather Modifiers", description: "Live weather data from OpenWeatherMap applies real-time adjustments of ±2–5 points to relevant verticals." },
        { title: "Calendar Signal", description: "Your Work-Life Balance score is adjusted based on calendar density — how many hours are locked in meetings today." },
        { title: "Data Source", description: "Scores currently use benchmark data. They improve in accuracy as you log more daily check-ins over time." },
      ]} />

    </div>
  );
}

/* ─── Sub-components ─── */

function VerticalCard({ vs, weight }: { vs: VerticalScoreData; weight: number }) {
  const config = VERTICAL_CONFIG[vs.vertical];
  const isHighWeight = weight >= 0.25;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #E2E8F0",
        borderLeft: isHighWeight ? "3px solid #1B4FD8" : "1px solid #E2E8F0",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-lg leading-none">{config.icon}</span>
        <TrendBadge trend={vs.trend} />
      </div>
      <div className="text-3xl font-bold leading-none" style={{ color: "#0F172A" }}>
        {vs.score}
      </div>
      <p className="mb-3 mt-1 text-xs leading-tight" style={{ color: "#94A3B8" }}>
        {config.label}
      </p>
      <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: "#E2E8F0" }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${vs.score}%`, backgroundColor: "#1B4FD8" }}
        />
      </div>
      <div className="mt-3 flex items-center gap-1 text-[11px] font-medium" style={{ color: "#1B4FD8" }}>
        <span>Details</span>
        <span>→</span>
      </div>
    </div>
  );
}

function TrendBadge({ trend }: { trend: number }) {
  const color = trend > 0 ? "#16A34A" : trend < 0 ? "#DC2626" : "#94A3B8";
  const arrow = trend > 0 ? "↑" : trend < 0 ? "↓" : "→";
  const label = trend > 0 ? `+${trend}` : trend === 0 ? "0" : String(trend);
  return (
    <span className="text-xs font-semibold tabular-nums" style={{ color }}>
      {arrow} {label}
    </span>
  );
}
