import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { WellbeingVertical } from "@/types";
import { getMockDashboardData } from "@/lib/mock-dashboard";
import { getOrGenerateAssessment, getWeekStart, type AssessmentResult } from "@/lib/ai";
import { Header } from "@/components/Header";
import { RegenerateButton } from "@/components/RegenerateButton";

/* ─── Design tokens ─── */
const PRIMARY = "#1B4FD8";
const TEXT    = "#0F172A";
const MUTED   = "#94A3B8";
const BORDER  = "#E2E8F0";
const GREEN   = "#16A34A";
const RED     = "#DC2626";

/* ─── Vertical config ─── */
const VERTICAL_CONFIG: Record<WellbeingVertical, { label: string; icon: string }> = {
  [WellbeingVertical.HEALTH]:    { label: "Health & Fitness",  icon: "🏃" },
  [WellbeingVertical.WORK_LIFE]: { label: "Work-Life Balance", icon: "⚖️" },
  [WellbeingVertical.SOCIAL]:    { label: "Social Connection", icon: "🤝" },
  [WellbeingVertical.PURPOSE]:   { label: "Sense of Purpose",  icon: "🧭" },
  [WellbeingVertical.SLEEP]:     { label: "Sleep & Energy",    icon: "🌙" },
};

const SUGGESTION_COLOR: Record<string, string> = {
  stop:     RED,
  start:    GREEN,
  continue: PRIMARY,
};
const SUGGESTION_BG: Record<string, string> = {
  stop:     "#FEF2F2",
  start:    "#F0FDF4",
  continue: "#EFF6FF",
};

/* ─── Helpers ─── */
function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endStr   = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

function weekKeyOf(d: Date): string {
  return d.toISOString().split("T")[0];
}

/* ─── Page ─── */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params    = await searchParams;
  const weekParam = typeof params.week === "string" ? params.week : undefined;

  const user = await prisma.user.findFirst();
  if (!user) redirect("/onboarding");

  const weights: Record<string, number> = user.verticalWeights
    ? JSON.parse(user.verticalWeights)
    : Object.fromEntries(Object.values(WellbeingVertical).map((v) => [v, 0.2]));

  /* ── Fetch the target report ── */
  let report = null;
  if (weekParam) {
    // Historical: find by week start date (1-day window for timezone safety)
    const weekDate = new Date(weekParam);
    weekDate.setHours(0, 0, 0, 0);
    const dayAfter = new Date(weekDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    report = await prisma.weeklyReport.findFirst({
      where: { userId: user.id, weekStartDate: { gte: weekDate, lt: dayAfter } },
    });
  } else {
    report = await prisma.weeklyReport.findFirst({
      where: { userId: user.id },
      orderBy: { weekStartDate: "desc" },
    });
  }

  /* ── Parse / generate assessment ── */
  let assessment: AssessmentResult | null = null;
  if (report) {
    try { assessment = JSON.parse(report.suggestions) as AssessmentResult; } catch { /* ignore */ }
  }
  // For the current week with no cached report, generate one now
  if (!assessment && !weekParam) {
    assessment = await getOrGenerateAssessment(user.id);
    if (!report) {
      report = await prisma.weeklyReport.findFirst({
        where: { userId: user.id },
        orderBy: { weekStartDate: "desc" },
      });
    }
  }

  /* ── All reports for navigation ── */
  const allReports = await prisma.weeklyReport.findMany({
    where: { userId: user.id },
    orderBy: { weekStartDate: "desc" },
  });

  /* ── Week range display ── */
  const effectiveWeekStart = report?.weekStartDate ?? getWeekStart();
  const weekRange = formatWeekRange(new Date(effectiveWeekStart));
  const isCurrentWeek =
    weekKeyOf(new Date(effectiveWeekStart)) === weekKeyOf(getWeekStart());

  /* ── Scores from mock dashboard ── */
  const { verticalScores } = getMockDashboardData(user.id);
  const overallScore = Math.round(
    verticalScores.reduce((sum, vs) => sum + vs.score * (weights[vs.vertical] ?? 0.2), 0)
  );
  const lastWeekScore = Math.round(
    verticalScores.reduce(
      (sum, vs) => sum + (vs.score - vs.trend) * (weights[vs.vertical] ?? 0.2),
      0
    )
  );
  const weekScoreDiff = overallScore - lastWeekScore;

  const displayScore =
    assessment?.weekScore && assessment.weekScore > 0 ? assessment.weekScore : overallScore;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      <Header backHref="/" pageLabel="Report" />

      <main className="mx-auto max-w-[680px] px-6 pt-8">

        {/* ── 1. Page header ── */}
        <div className="mb-8">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            {weekRange}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: TEXT }}>
            Weekly Report
          </h1>
          <div className="mt-4 flex items-end gap-4">
            <div>
              <div className="text-5xl font-bold leading-none tabular-nums" style={{ color: TEXT }}>
                {displayScore}
              </div>
              <p className="mt-1 text-xs" style={{ color: MUTED }}>This week&apos;s score</p>
            </div>
            <p
              className="mb-1 text-sm"
              style={{ color: weekScoreDiff > 0 ? GREEN : weekScoreDiff < 0 ? RED : MUTED }}
            >
              {weekScoreDiff > 0
                ? `↑ +${weekScoreDiff} vs last week`
                : weekScoreDiff < 0
                ? `↓ ${weekScoreDiff} vs last week`
                : "→ Same as last week"}
            </p>
          </div>
        </div>

        {/* ── 2. Narrative summary ── */}
        <div
          className="mb-4 rounded-xl p-5"
          style={{ backgroundColor: "#F8FAFC", border: `1px solid ${BORDER}` }}
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Summary
          </p>
          {assessment?.overallNarrative ? (
            <p className="text-sm italic leading-relaxed" style={{ color: "#475569" }}>
              &ldquo;{assessment.overallNarrative}&rdquo;
            </p>
          ) : (
            <p className="text-sm" style={{ color: MUTED }}>
              Your first weekly report will be generated after your first check-in.
            </p>
          )}
        </div>

        {/* ── 3. Vertical breakdown ── */}
        <div className="mb-4 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            Vertical breakdown
          </p>
          <div className="flex flex-col gap-5">
            {verticalScores.map((vs, i) => {
              const cfg = VERTICAL_CONFIG[vs.vertical];
              const aiInsight = assessment?.verticalInsights.find(
                (vi) => vi.vertical === vs.vertical
              )?.insight;
              return (
                <div key={vs.vertical}>
                  {i > 0 && (
                    <div className="mb-5" style={{ borderTop: `1px solid ${BORDER}` }} />
                  )}
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: TEXT }}>
                      {cfg.icon} {cfg.label}
                    </span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: PRIMARY }}>
                      {vs.score}
                    </span>
                  </div>
                  <div className="mb-2 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: BORDER }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${vs.score}%`, backgroundColor: PRIMARY }}
                    />
                  </div>
                  {aiInsight && (
                    <p className="text-xs italic leading-relaxed" style={{ color: MUTED }}>
                      {aiInsight}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 4. Stop / Start / Continue ── */}
        <div className="mb-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            This week&apos;s focus
          </p>
          <div className="flex flex-col gap-3">
            {assessment?.suggestions?.length ? (
              assessment.suggestions.map((s) => {
                const color = SUGGESTION_COLOR[s.category] ?? MUTED;
                const bg    = SUGGESTION_BG[s.category]  ?? "#F8FAFC";
                return (
                  <div
                    key={s.category}
                    className="rounded-xl p-5"
                    style={{ backgroundColor: bg, border: `1px solid ${color}22` }}
                  >
                    <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color }}>
                      {s.category}
                    </p>
                    <p className="text-base font-bold leading-snug" style={{ color: TEXT }}>
                      {s.action}
                    </p>
                    <p className="mt-1 text-xs italic leading-relaxed" style={{ color: MUTED }}>
                      {s.reasoning}
                    </p>
                  </div>
                );
              })
            ) : (
              (["stop", "start", "continue"] as const).map((cat) => (
                <div
                  key={cat}
                  className="rounded-xl p-5"
                  style={{ backgroundColor: "#F8FAFC", border: `1px solid ${BORDER}` }}
                >
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                    {cat}
                  </p>
                  <p className="text-sm" style={{ color: MUTED }}>
                    — Suggestions will appear after your assessment is generated
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── 5. Forecast ── */}
        <div
          className="mb-4 rounded-xl p-5"
          style={{ backgroundColor: "#F8FAFC", border: `1px solid ${BORDER}` }}
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
            🔮 If this week continues...
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "#475569" }}>
            {assessment?.forecast ?? "Complete your first week of check-ins to unlock a personalized forecast."}
          </p>
        </div>

        {/* ── 6. Report history navigation ── */}
        {allReports.length > 1 && (
          <div className="mb-6 rounded-xl bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: MUTED }}>
              Previous reports
            </p>
            <div className="flex flex-col">
              {allReports.map((r, i) => {
                const rStart    = new Date(r.weekStartDate);
                const rRange    = formatWeekRange(rStart);
                const rKey      = weekKeyOf(rStart);
                const isCurrent = rKey === weekKeyOf(getWeekStart());
                const isSelected = weekParam ? weekParam === rKey : i === 0;

                let rScore: number | null = null;
                try {
                  const parsed = JSON.parse(r.suggestions) as AssessmentResult;
                  rScore = parsed.weekScore && parsed.weekScore > 0 ? parsed.weekScore : null;
                } catch { /* ignore */ }

                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-3"
                    style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : "none" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: TEXT }}>
                        {rRange}
                      </p>
                      {isCurrent && (
                        <span className="text-[10px] font-semibold" style={{ color: PRIMARY }}>
                          Current week
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {rScore != null && (
                        <span className="text-sm tabular-nums" style={{ color: MUTED }}>
                          {rScore}
                        </span>
                      )}
                      {isSelected ? (
                        <span className="text-xs" style={{ color: MUTED }}>Viewing</span>
                      ) : (
                        <Link
                          href={isCurrent ? "/report" : `/report?week=${rKey}`}
                          className="text-xs font-semibold"
                          style={{ color: PRIMARY }}
                        >
                          View →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 7. Regenerate (current week only) ── */}
        {isCurrentWeek && (
          <div className="flex justify-center pb-4">
            <RegenerateButton />
          </div>
        )}

      </main>
    </div>
  );
}
