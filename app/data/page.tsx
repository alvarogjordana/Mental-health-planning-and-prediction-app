export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getWeatherData } from "@/lib/integrations/weather";
import { getCalendarData } from "@/lib/integrations/calendar";
import { Header } from "@/components/Header";
import { PageRefreshButton } from "@/components/PageRefreshButton";
import { MoodBarChart, type MoodPoint } from "@/components/charts/MoodBarChart";

/* ─── Design tokens ─── */
const TEXT   = "#0F172A";
const MUTED  = "#94A3B8";
const BORDER = "#E2E8F0";
const PRIMARY = "#1B4FD8";

/* ─── Helpers ─── */

function fmtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function scoreStyle(score: number | null): React.CSSProperties {
  if (score === null) return { color: MUTED };
  if (score >= 70) return { color: "#16A34A", backgroundColor: "#F0FDF4", borderRadius: 4, padding: "1px 6px" };
  if (score >= 50) return { color: "#B45309", backgroundColor: "#FEF3C7", borderRadius: 4, padding: "1px 6px" };
  return { color: "#DC2626", backgroundColor: "#FEF2F2", borderRadius: 4, padding: "1px 6px" };
}

function mtgTimeStyle(mins: number): React.CSSProperties {
  const hrs = mins / 60;
  if (hrs < 2)  return { color: "#16A34A", backgroundColor: "#F0FDF4", borderRadius: 4, padding: "1px 6px" };
  if (hrs <= 4) return { color: "#B45309", backgroundColor: "#FEF3C7", borderRadius: 4, padding: "1px 6px" };
  return { color: "#DC2626", backgroundColor: "#FEF2F2", borderRadius: 4, padding: "1px 6px" };
}

function sleepHrsStyle(hrs: number): React.CSSProperties {
  if (hrs >= 7) return { color: "#16A34A", backgroundColor: "#F0FDF4", borderRadius: 4, padding: "1px 6px" };
  if (hrs >= 6) return { color: "#B45309", backgroundColor: "#FEF3C7", borderRadius: 4, padding: "1px 6px" };
  return { color: "#DC2626", backgroundColor: "#FEF2F2", borderRadius: 4, padding: "1px 6px" };
}

function conditionBadge(condition: string): { emoji: string; color: string } {
  if (condition === "Clear")   return { emoji: "☀️",  color: "#F59E0B" };
  if (condition === "Clouds")  return { emoji: "☁️",  color: "#64748B" };
  if (condition === "Rain" || condition === "Drizzle") return { emoji: "🌧️", color: "#2563EB" };
  if (condition === "Snow")    return { emoji: "❄️",  color: "#94A3B8" };
  return { emoji: "🌤️", color: "#64748B" };
}

function dateToISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ─── Shared layout components ─── */

function SectionCard({
  title,
  badge,
  badgeLabel,
  affectsNote,
  children,
}: {
  title: string;
  badge: string;
  badgeLabel: string;
  affectsNote: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-white"
      style={{ border: `1px solid ${BORDER}` }}
    >
      <div
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <h2 className="text-base font-bold" style={{ color: TEXT }}>{title}</h2>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: "#F1F5F9", color: MUTED }}
        >
          {badge} · {badgeLabel}
        </span>
      </div>
      <div className="px-6 py-5">{children}</div>
      <div
        className="px-6 pb-4 text-[11px]"
        style={{ color: MUTED }}
      >
        Affects: {affectsNote}
      </div>
    </section>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="py-2 pr-4 text-left text-[11px] font-semibold uppercase tracking-wider"
      style={{ color: MUTED }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <td className="py-2 pr-4 text-sm" style={{ color: TEXT, ...style }}>
      {children}
    </td>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: "#F8FAFC", border: `1px solid ${BORDER}` }}
    >
      <div className="text-lg font-bold" style={{ color: TEXT }}>{value}</div>
      <div className="text-[11px] font-medium" style={{ color: MUTED }}>{label}</div>
    </div>
  );
}

function ProgressBar({ label, current, total }: { label: string; current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  const color = pct >= 80 ? "#16A34A" : pct >= 50 ? "#F59E0B" : "#DC2626";
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span style={{ color: TEXT }}>{label}</span>
        <span style={{ color: MUTED }}>{current}/{total} days</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: BORDER }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

/* ─── Page ─── */

export default async function DataPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch all data in parallel — each fails independently
  const [weatherResult, calendarResult, moodResult, vsResult, wlogResult] =
    await Promise.allSettled([
      getWeatherData(user.id),
      getCalendarData(),
      prisma.moodLog.findMany({
        where: { userId: user.id, date: { gte: fourteenDaysAgo } },
        orderBy: { date: "desc" },
      }),
      prisma.verticalScore.findMany({
        where: { userId: user.id, date: { gte: fourteenDaysAgo } },
        orderBy: { date: "desc" },
      }),
      prisma.weatherLog.findMany({
        where: { userId: user.id, date: { gte: sevenDaysAgo } },
        select: { date: true },
      }),
    ]);

  const weatherData   = weatherResult.status  === "fulfilled" ? weatherResult.value  : null;
  const calendarData  = calendarResult.status === "fulfilled" ? calendarResult.value : null;
  const rawMoodLogs   = moodResult.status     === "fulfilled" ? moodResult.value     : [];
  const dbVertScores  = vsResult.status       === "fulfilled" ? vsResult.value       : [];
  const weatherLogs   = wlogResult.status     === "fulfilled" ? wlogResult.value     : [];

  // Parse mood logs
  const parsedMoods = rawMoodLogs.map(log => {
    let answers: Array<{ questionId: string; answer: string }> = [];
    try { answers = JSON.parse(log.answers); } catch { /* ignore */ }
    const get = (id: string) => answers.find(a => a.questionId === id)?.answer ?? "";
    const sleepRaw = get("sleepHours");
    const sleepHours = sleepRaw !== "" ? parseFloat(sleepRaw) : null;
    const exercisedRaw = get("exercised");
    const exercised = exercisedRaw === "yes" ? true : exercisedRaw === "no" ? false : null;
    return {
      id:         log.id,
      date:       new Date(log.date),
      dateISO:    dateToISO(new Date(log.date)),
      dateLabel:  fmtDate(new Date(log.date)),
      mood:       get("mood"),
      score:      Math.round(log.overallScore),
      driver:     get("primaryDriver"),
      reflection: get("reflection"),
      sleepHours,
      exercised,
    };
  });

  // Build score history from real VerticalScore records grouped by date
  const vsByDate = new Map<string, Partial<Record<string, number>>>();
  for (const vs of dbVertScores) {
    const iso = dateToISO(new Date(vs.date));
    if (!vsByDate.has(iso)) vsByDate.set(iso, {});
    vsByDate.get(iso)![vs.vertical] = Math.round(vs.score);
  }
  const scoreHistory = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - i));
    const iso = dateToISO(d);
    const vs = vsByDate.get(iso) ?? {};
    const health   = vs[WellbeingVertical.HEALTH]    ?? null;
    const workLife = vs[WellbeingVertical.WORK_LIFE]  ?? null;
    const social   = vs[WellbeingVertical.SOCIAL]     ?? null;
    const purpose  = vs[WellbeingVertical.PURPOSE]    ?? null;
    const sleep    = vs[WellbeingVertical.SLEEP]      ?? null;
    const hasData  = health !== null || workLife !== null || social !== null || purpose !== null || sleep !== null;
    const overall  = hasData ? Math.round(
      (health   ?? 0) * (weights[WellbeingVertical.HEALTH]    ?? 0.2) +
      (workLife ?? 0) * (weights[WellbeingVertical.WORK_LIFE]  ?? 0.2) +
      (social   ?? 0) * (weights[WellbeingVertical.SOCIAL]     ?? 0.2) +
      (purpose  ?? 0) * (weights[WellbeingVertical.PURPOSE]    ?? 0.2) +
      (sleep    ?? 0) * (weights[WellbeingVertical.SLEEP]      ?? 0.2)
    ) : null;
    return { dateLabel: fmtDate(d), iso, overall, health, workLife, social, purpose, sleep };
  });

  // Sets for source computation
  const hasRealCalendar = !!(
    process.env.ICAL_CASA_URL    ||
    process.env.ICAL_OUTLOOK_URL
  );
  const checkinDates = new Set(parsedMoods.map(m => m.dateISO));

  // Completeness counts (last 7 days)
  const weatherComplete  = weatherLogs.length;
  const calendarComplete = calendarData?.last7Days.filter(d => d.totalEvents > 0).length ?? 0;
  const moodLast7        = parsedMoods.filter(m => m.date >= sevenDaysAgo).length;
  const overallComplete  = Math.round(
    ((weatherComplete + calendarComplete + moodLast7 + moodLast7) / (7 * 4)) * 100
  );

  // Avatar initials for header
  const initials = user.name.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase();

  // Mood chart data — oldest first, last 14 days
  const moodChartData: MoodPoint[] = [...parsedMoods].reverse().map(m => ({
    date: m.dateLabel,
    score: m.score,
    mood: m.mood,
    driver: m.driver,
    reflection: m.reflection,
  }));

  // Summary mood stats
  const avgMoodScore = parsedMoods.length
    ? Math.round(parsedMoods.reduce((s, m) => s + m.score, 0) / parsedMoods.length)
    : 0;
  const bestMood  = parsedMoods.length ? parsedMoods.reduce((a, b) => a.score > b.score ? a : b) : null;
  const worstMood = parsedMoods.length ? parsedMoods.reduce((a, b) => a.score < b.score ? a : b) : null;
  const moodCounts: Record<string, number> = {};
  for (const m of parsedMoods) {
    const label = m.mood.split(" ").slice(1).join(" ") || m.mood;
    moodCounts[label] = (moodCounts[label] ?? 0) + 1;
  }
  const mostCommonMood = Object.entries(moodCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "—";

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: "#F8FAFC" }}>
      <Header backHref="/" pageLabel="Data" initials={initials} />

      <main className="mx-auto max-w-[780px] px-6 pt-8">

        {/* ── Page header ── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: TEXT }}>Your Data</h1>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Everything Freedom uses to understand your wellbeing
            </p>
            <p className="mt-1 text-[11px]" style={{ color: "#CBD5E1" }}>
              Last updated: {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}{" "}
              at {fmtTime(now)}
            </p>
          </div>
          <PageRefreshButton />
        </div>

        <div className="flex flex-col gap-6">

          {/* ══ Section 1: Weather ══ */}
          <SectionCard
            title={`🌤️ Weather — ${weatherData?.current.city ?? user.location ?? "—"}`}
            badge="OpenWeatherMap API"
            badgeLabel="Live"
            affectsNote="Health & Fitness, Sleep & Energy, Social Connection"
          >
            {weatherData ? (
              <>
                {/* Current conditions */}
                <div
                  className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4"
                >
                  <StatPill label="Temperature" value={`${weatherData.current.tempF}°F`} />
                  <StatPill label="Condition"   value={`${conditionBadge(weatherData.current.condition).emoji} ${weatherData.current.condition}`} />
                  <StatPill label="Humidity"    value={`${weatherData.current.humidity}%`} />
                  <StatPill label="Wind"        value={`${weatherData.current.windMph} mph`} />
                </div>

                {/* 7-day historical table */}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Last 7 days
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px]">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <Th>Date</Th>
                        <Th>Temp (°F)</Th>
                        <Th>Condition</Th>
                        <Th>Humidity</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {weatherData.last7Days.map((day, i) => {
                        const { emoji, color } = conditionBadge(day.condition);
                        return (
                          <tr key={day.date} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                            <Td>{fmtDate(day.date)}</Td>
                            <Td>{day.tempF}°F</Td>
                            <Td><span style={{ color }}>{emoji} {day.condition}</span></Td>
                            <Td>{day.humidity}%</Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5-day forecast table */}
                {weatherData.next5Days.length > 0 && (
                  <>
                    <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                      5-day forecast
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[400px]">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                            <Th>Date</Th>
                            <Th>Temp (°F)</Th>
                            <Th>Condition</Th>
                            <Th>Humidity</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {weatherData.next5Days.map((day, i) => {
                            const { emoji, color } = conditionBadge(day.condition);
                            return (
                              <tr key={day.date} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                                <Td>{fmtDate(day.date)}</Td>
                                <Td>{day.tempF}°F</Td>
                                <Td><span style={{ color }}>{emoji} {day.condition}</span></Td>
                                <Td>{day.humidity}%</Td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>Weather data unavailable.</p>
            )}
          </SectionCard>

          {/* ══ Section 2: Calendar ══ */}
          <SectionCard
            title="📅 Calendar — Casa &amp; HBS Outlook"
            badge="iCal feeds"
            badgeLabel="Refreshed hourly"
            affectsNote="Work-Life Balance, Social Connection, Health & Fitness"
          >
            {calendarData ? (
              <>
                {/* Summary pill — locked hours */}
                {(() => {
                  const n = calendarData.last7Days.length || 1;
                  const avgBlocked = (calendarData.last7Days.reduce((s, d) => s + d.totalBlockedMinutes, 0) / n / 60).toFixed(1);
                  return (
                    <div className="mb-5">
                      <StatPill label="Avg hrs locked/day" value={`${avgBlocked}h`} />
                    </div>
                  );
                })()}

                {/* 7-day hours table */}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Last 7 days — hours blocked
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[300px]">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <Th>Date</Th>
                        <Th>Hrs locked</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {calendarData.last7Days.map((day, i) => {
                        const locked = day.totalBlockedMinutes / 60;
                        return (
                          <tr key={day.date} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                            <Td>{day.date}</Td>
                            <Td>
                              <span style={mtgTimeStyle(day.totalBlockedMinutes)}>
                                {locked.toFixed(1)}h
                              </span>
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Today's schedule */}
                <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Today&apos;s remaining schedule
                </p>
                {calendarData.summary.upcomingToday.length === 0 ? (
                  <p className="text-sm" style={{ color: "#CBD5E1" }}>
                    Nothing scheduled for the rest of today
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {calendarData.summary.upcomingToday.map((ev, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: "#F8FAFC" }}
                      >
                        <span className="shrink-0 tabular-nums" style={{ color: MUTED }}>
                          {fmtTime(ev.start)}
                        </span>
                        <span style={{ color: TEXT }}>{ev.title}</span>
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: ev.type === "meeting" ? "#EFF6FF" : "#F0FDF4",
                            color: ev.type === "meeting" ? "#2563EB" : "#16A34A",
                          }}
                        >
                          {ev.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: MUTED }}>Calendar data unavailable.</p>
            )}
          </SectionCard>

          {/* ══ Section 3: Health & Sleep ══ */}
          <SectionCard
            title="🏃 Health &amp; Sleep — Daily check-ins"
            badge="Self-reported"
            badgeLabel="Updated on each check-in"
            affectsNote="Health & Fitness, Sleep & Energy"
          >
            {parsedMoods.length < 3 && (
              <div
                className="mb-4 rounded-lg px-4 py-3 text-sm"
                style={{ backgroundColor: "#FEF3C7", border: "1px solid #FCD34D", color: "#92400E" }}
              >
                Log more check-ins to see your health trends — you have {parsedMoods.length} so far
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <Th>Date</Th>
                    <Th>Sleep (est.)</Th>
                    <Th>Sleep score</Th>
                    <Th>Exercise</Th>
                    <Th>Energy</Th>
                    <Th>Health score</Th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date(now);
                    d.setDate(d.getDate() - (6 - i));
                    const dateLabel = fmtDate(d);
                    const mood = parsedMoods.find(m => m.date.toDateString() === d.toDateString());
                    const sleepHrs = mood?.sleepHours ?? null;
                    const isExercise = mood?.exercised ?? null;
                    const energy =
                      !mood ? "—"
                      : mood.score >= 80 ? "High 🔥"
                      : mood.score >= 60 ? "Good"
                      : mood.score >= 40 ? "Low 😕"
                      : "Very low";
                    const sleepScore = sleepHrs !== null
                      ? Math.min(100, sleepHrs >= 8 ? 100 : sleepHrs >= 7 ? Math.round(70 + (sleepHrs - 7) * 30) : sleepHrs >= 6 ? Math.round(45 + (sleepHrs - 6) * 25) : Math.round(sleepHrs * 7.5))
                      : null;
                    const healthScore = (sleepScore !== null || isExercise !== null)
                      ? Math.min(100, Math.round((sleepScore ?? 60) * 0.8 + (isExercise === true ? 20 : 0)))
                      : null;

                    return (
                      <tr key={dateLabel} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                        <Td>{dateLabel}</Td>
                        <Td>
                          {sleepHrs !== null
                            ? <span style={sleepHrsStyle(sleepHrs)}>{sleepHrs}h</span>
                            : <span style={{ color: MUTED }}>—</span>}
                        </Td>
                        <Td>
                          {sleepScore !== null
                            ? <span style={scoreStyle(sleepScore)}>{sleepScore}</span>
                            : <span style={{ color: MUTED }}>—</span>}
                        </Td>
                        <Td>
                          {isExercise === null
                            ? <span style={{ color: MUTED }}>—</span>
                            : <span style={{ color: isExercise ? "#16A34A" : MUTED, fontWeight: isExercise ? 600 : 400 }}>
                                {isExercise ? "✓" : "✗"}
                              </span>}
                        </Td>
                        <Td>{energy}</Td>
                        <Td>
                          {healthScore !== null
                            ? <span style={scoreStyle(healthScore)}>{healthScore}</span>
                            : <span style={{ color: MUTED }}>—</span>}
                        </Td>
                      </tr>
                    );
                  })}
                  {/* Average row */}
                  {(() => {
                    const last7 = parsedMoods.filter(m => m.date >= sevenDaysAgo);
                    const withSleep = last7.filter(m => m.sleepHours !== null);
                    const avgSleep = withSleep.length
                      ? Math.round((withSleep.reduce((s, m) => s + m.sleepHours!, 0) / withSleep.length) * 10) / 10
                      : null;
                    const avgSleepScore = avgSleep !== null
                      ? Math.min(100, avgSleep >= 8 ? 100 : avgSleep >= 7 ? Math.round(70 + (avgSleep - 7) * 30) : avgSleep >= 6 ? Math.round(45 + (avgSleep - 6) * 25) : Math.round(avgSleep * 7.5))
                      : null;
                    return (
                      <tr style={{ borderTop: `1px solid ${BORDER}`, backgroundColor: "#F1F5F9" }}>
                        <Td><span className="font-semibold">7-day avg</span></Td>
                        <Td>{avgSleep !== null ? <span style={sleepHrsStyle(avgSleep)}>{avgSleep}h</span> : <span style={{ color: MUTED }}>—</span>}</Td>
                        <Td>{avgSleepScore !== null ? <span style={scoreStyle(avgSleepScore)}>{avgSleepScore}</span> : <span style={{ color: MUTED }}>—</span>}</Td>
                        <Td>—</Td>
                        <Td>—</Td>
                        <Td>—</Td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {/* ══ Section 4: Mood Logs ══ */}
          <SectionCard
            title="😊 Mood — Daily check-ins"
            badge="Self-reported"
            badgeLabel="Updated on each check-in"
            affectsNote="All verticals"
          >
            {parsedMoods.length === 0 ? (
              <p className="text-sm" style={{ color: MUTED }}>
                No mood check-ins yet. Start logging daily to see your mood trends.
              </p>
            ) : (
              <>
                {/* Summary stats */}
                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatPill label="Most common mood" value={mostCommonMood} />
                  <StatPill label="Average score"    value={`${avgMoodScore}/100`} />
                  <StatPill label="Best day"  value={bestMood ? `${bestMood.dateLabel} (${bestMood.score})` : "—"} />
                  <StatPill label="Hardest day" value={worstMood ? `${worstMood.dateLabel} (${worstMood.score})` : "—"} />
                </div>

                {/* Bar chart */}
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  14-day mood score
                </p>
                <MoodBarChart data={moodChartData} />

                {/* Mood log table */}
                <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                  Check-in log
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[500px]">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                        <Th>Date</Th>
                        <Th>Mood</Th>
                        <Th>Score</Th>
                        <Th>Primary driver</Th>
                        <Th>Reflection</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedMoods.map((m, i) => (
                        <tr key={m.id} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                          <Td>{m.dateLabel}</Td>
                          <Td>{m.mood}</Td>
                          <Td><span style={scoreStyle(m.score)}>{m.score}</span></Td>
                          <Td>{m.driver || "—"}</Td>
                          <Td>
                            <span className="italic" style={{ color: MUTED }}>
                              {m.reflection
                                ? (m.reflection.length > 60 ? m.reflection.slice(0, 60) + "…" : m.reflection)
                                : "—"}
                            </span>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </SectionCard>

          {/* ══ Section 5: Vertical Score History ══ */}
          <section className="rounded-xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <h2 className="text-base font-bold" style={{ color: TEXT }}>
                📊 Score History — All verticals
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: "#F1F5F9", color: MUTED }}
              >
                Computed · Updated daily
              </span>
            </div>
            <div className="px-6 py-5">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                      <Th>Date</Th>
                      <Th>Overall</Th>
                      <Th>Health</Th>
                      <Th>Work-Life</Th>
                      <Th>Social</Th>
                      <Th>Purpose</Th>
                      <Th>Sleep</Th>
                      <Th>Source</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreHistory.map((day, i) => {
                      const hasCheckin = checkinDates.has(day.iso);
                      const source = day.overall === null ? "No data"
                        : hasCheckin && hasRealCalendar ? "Check-in + Calendar"
                        : hasCheckin ? "Check-in"
                        : "Check-in (seeded)";
                      const sourceColor = day.overall === null ? MUTED : "#16A34A";

                      const fmt = (v: number | null) => v !== null
                        ? <span style={scoreStyle(v)}>{v}</span>
                        : <span style={{ color: MUTED }}>—</span>;

                      return (
                        <tr key={day.iso} style={{ backgroundColor: i % 2 === 0 ? "#fff" : "#F8FAFC" }}>
                          <Td>{day.dateLabel}</Td>
                          <Td>
                            {day.overall !== null
                              ? <span style={{ ...scoreStyle(day.overall), fontWeight: 700 }}>{day.overall}</span>
                              : <span style={{ color: MUTED }}>—</span>}
                          </Td>
                          <Td>{fmt(day.health)}</Td>
                          <Td>{fmt(day.workLife)}</Td>
                          <Td>{fmt(day.social)}</Td>
                          <Td>{fmt(day.purpose)}</Td>
                          <Td>{fmt(day.sleep)}</Td>
                          <Td>
                            <span className="text-[11px] font-medium" style={{ color: sourceColor }}>
                              {source}
                            </span>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px]" style={{ color: MUTED }}>
                Scores are weighted averages of the 5 verticals using your personal priority weights.
                Weather and calendar signals apply real-time modifiers.
              </p>
            </div>
          </section>

          {/* ══ Section 6: Data completeness ══ */}
          <section className="rounded-xl bg-white" style={{ border: `1px solid ${BORDER}` }}>
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${BORDER}` }}
            >
              <h2 className="text-base font-bold" style={{ color: TEXT }}>
                📡 Data completeness
              </h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: "#F1F5F9", color: MUTED }}
              >
                Last 7 days
              </span>
            </div>
            <div className="px-6 py-5">
              <div className="mb-5 flex items-center gap-4">
                <div
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold"
                  style={{
                    backgroundColor: overallComplete >= 75 ? "#F0FDF4" : overallComplete >= 50 ? "#FEF3C7" : "#FEF2F2",
                    color: overallComplete >= 75 ? "#16A34A" : overallComplete >= 50 ? "#B45309" : "#DC2626",
                  }}
                >
                  {overallComplete}%
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: TEXT }}>
                    Overall data completeness
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    The more you check in, the more accurate your assessment becomes
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <ProgressBar label="🌤️ Weather (real API logs)" current={weatherComplete}  total={7} />
                <ProgressBar label="📅 Calendar (days with events)"  current={calendarComplete} total={7} />
                <ProgressBar label="😊 Mood check-ins"              current={moodLast7}       total={7} />
                <ProgressBar label="🏃 Health self-reports"          current={moodLast7}       total={7} />
              </div>

              <p className="mt-5 text-xs italic" style={{ color: MUTED }}>
                Tip: Daily check-ins unlock vertical-specific insights and improve the accuracy of your AI assessment.
                Weather and calendar data are collected automatically.
              </p>
            </div>
          </section>

        </div>
      </main>
    </div>
  );
}
