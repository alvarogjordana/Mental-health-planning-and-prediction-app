export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Header } from "@/components/Header";

/* ─── Design tokens ─── */
const TEXT   = "#0F172A";
const MUTED  = "#94A3B8";
const BORDER = "#E2E8F0";

/* ─── Mood config ─── */
const MOOD_CONFIG = [
  { label: "Struggling", emoji: "😔", color: "#DC2626", bg: "#FEF2F2" },
  { label: "Low",        emoji: "😕", color: "#F97316", bg: "#FFF7ED" },
  { label: "Okay",       emoji: "😐", color: "#F59E0B", bg: "#FFFBEB" },
  { label: "Good",       emoji: "🙂", color: "#84CC16", bg: "#F7FEE7" },
  { label: "Great",      emoji: "😄", color: "#16A34A", bg: "#F0FDF4" },
] as const;

const DRIVER_EMOJIS: Record<string, string> = {
  "Sleep":                   "😴",
  "Exercise":                "💪",
  "Social time":             "👥",
  "Work / calendar":         "📅",
  "Mental load":             "🧠",
  "Weather & environment":   "🌤️",
  "Sense of progress":       "🎯",
  "Relationships":           "❤️",
};

/* ─── Helpers ─── */

/** Returns the Monday of the week containing `date` (local time). */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekLabel(monday: Date): string {
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function weekKey(monday: Date): string {
  return monday.toISOString().split("T")[0];
}

function moodFromString(mood: string) {
  return MOOD_CONFIG.find((m) => mood.includes(m.label)) ?? MOOD_CONFIG[2];
}

function moodBorderColor(mood: string): string {
  const m = moodFromString(mood);
  if (m.label === "Great" || m.label === "Good") return "#16A34A";
  if (m.label === "Okay") return "#F59E0B";
  return "#DC2626";
}

/* ─── Page ─── */
export default async function HistoryPage() {
  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  /* Fetch all mood logs for this user, newest first */
  const rawLogs = await prisma.moodLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  type ParsedLog = {
    id: string;
    date: Date;
    mood: string;
    primaryDriver: string;
    reflection: string;
    overallScore: number;
  };

  const logs: ParsedLog[] = rawLogs.map((log) => {
    let answers: Array<{ questionId: string; answer: string }> = [];
    try { answers = JSON.parse(log.answers); } catch { /* ignore */ }
    const get = (id: string) => answers.find((a) => a.questionId === id)?.answer ?? "";
    return {
      id:            log.id,
      date:          log.date,
      mood:          get("mood"),
      primaryDriver: get("primaryDriver"),
      reflection:    get("reflection"),
      overallScore:  log.overallScore,
    };
  });

  /* ── Mood distribution ── */
  const moodCounts: Record<string, number> = Object.fromEntries(
    MOOD_CONFIG.map((m) => [m.label, 0])
  );
  for (const log of logs) {
    const matched = MOOD_CONFIG.find((m) => log.mood.includes(m.label));
    if (matched) moodCounts[matched.label]++;
  }
  const total = logs.length;

  /* ── Group by week ── */
  type WeekGroup = {
    label: string;
    key: string;
    logs: ParsedLog[];
  };

  const groupMap = new Map<string, WeekGroup>();
  for (const log of logs) {
    const monday = getWeekMonday(new Date(log.date));
    const key = weekKey(monday);
    if (!groupMap.has(key)) {
      groupMap.set(key, { label: weekLabel(monday), key, logs: [] });
    }
    groupMap.get(key)!.logs.push(log);
  }
  const weekGroups = Array.from(groupMap.values());

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <Header backHref="/" pageLabel="History" />

      <main className="mx-auto max-w-[680px] px-6 pt-8">

        {/* ── 1. Page title ── */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: TEXT }}>
              Check-in History
            </h1>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>
              Every mood log, in one place
            </p>
          </div>
          {total > 0 && (
            <span
              className="mt-1 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: "#F1F5F9", color: MUTED }}
            >
              {total} check-in{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {total === 0 ? (
          /* ── Empty state ── */
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 text-5xl opacity-30">📋</div>
            <h2 className="mb-2 text-base font-semibold" style={{ color: TEXT }}>
              No check-ins yet
            </h2>
            <p className="mb-6 max-w-xs text-sm leading-relaxed" style={{ color: MUTED }}>
              Start logging your mood daily to see your history here.
            </p>
            <Link
              href="/checkin"
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: "#1B4FD8" }}
            >
              Log today&apos;s check-in →
            </Link>
          </div>
        ) : (
          <>
            {/* ── 2. Mood distribution bar ── */}
            <div
              className="mb-6 rounded-xl bg-white p-5"
              style={{ border: `1px solid ${BORDER}` }}
            >
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
                Your mood distribution
              </p>

              {/* Bar */}
              <div className="flex h-3 overflow-hidden rounded-full">
                {MOOD_CONFIG.map((m) => {
                  const pct = total > 0 ? (moodCounts[m.label] / total) * 100 : 20;
                  return (
                    <div
                      key={m.label}
                      style={{ width: `${pct}%`, backgroundColor: m.color, minWidth: pct > 0 ? 2 : 0 }}
                    />
                  );
                })}
              </div>

              {/* Labels */}
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                {MOOD_CONFIG.filter((m) => moodCounts[m.label] > 0).map((m) => (
                  <span key={m.label} className="flex items-center gap-1 text-xs" style={{ color: MUTED }}>
                    <span style={{ color: m.color }}>●</span>
                    {m.emoji} {moodCounts[m.label]}
                  </span>
                ))}
              </div>
            </div>

            {/* ── 3. Week groups ── */}
            <div className="flex flex-col gap-6">
              {weekGroups.map((group) => (
                <div key={group.key}>
                  {/* Week divider */}
                  <p
                    className="mb-3 text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: MUTED }}
                  >
                    {group.label}
                  </p>

                  {/* Log cards */}
                  <div className="flex flex-col gap-2">
                    {group.logs.map((log) => {
                      const moodCfg = moodFromString(log.mood);
                      const borderColor = moodBorderColor(log.mood);
                      const driverEmoji = DRIVER_EMOJIS[log.primaryDriver] ?? "•";
                      const dateObj = new Date(log.date);
                      const dateStr = dateObj.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      });

                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-4 rounded-xl bg-white px-5 py-4"
                          style={{
                            border: `1px solid ${BORDER}`,
                            borderLeft: `3px solid ${borderColor}`,
                          }}
                        >
                          {/* Date */}
                          <div className="w-28 shrink-0">
                            <p className="text-xs font-medium leading-snug" style={{ color: TEXT }}>
                              {dateStr.split(",")[0]}
                            </p>
                            <p className="text-[11px]" style={{ color: MUTED }}>
                              {dateStr.replace(/^[^,]+, /, "")}
                            </p>
                          </div>

                          {/* Center */}
                          <div className="min-w-0 flex-1">
                            {/* Mood */}
                            <p className="text-base font-semibold leading-tight" style={{ color: TEXT }}>
                              {moodCfg.emoji} {moodCfg.label}
                            </p>

                            {/* Driver pill */}
                            {log.primaryDriver && (
                              <span
                                className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
                              >
                                {driverEmoji} {log.primaryDriver}
                              </span>
                            )}

                            {/* Reflection */}
                            {log.reflection && (
                              <p
                                className="mt-2 text-xs italic leading-relaxed"
                                style={{ color: MUTED }}
                              >
                                &ldquo;{log.reflection}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Score badge */}
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                            style={{
                              backgroundColor: moodCfg.bg,
                              color: moodCfg.color,
                            }}
                          >
                            {Math.round(log.overallScore)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
