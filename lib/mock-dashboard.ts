import { WellbeingVertical } from "@/types";

export interface VerticalScoreData {
  vertical: WellbeingVertical;
  score: number;    // 0–100, this week
  trend: number;    // delta vs. last week (e.g. +5 or -3)
  trendDays: number[]; // 7 daily scores, oldest → newest (for future sparklines)
}

export interface MockDashboardData {
  verticalScores: VerticalScoreData[];
}

/* ─── 14-day trend data (for Trends & Forecast page) ─── */

export interface TrendDataPoint {
  date: string;         // e.g. "Apr 1"
  isForecast: boolean;  // true for the 7 projected future days
  overall: number;      // weighted overall score
  health: number;
  workLife: number;
  social: number;
  purpose: number;
  sleep: number;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/** Clamp for forecast values — keeps projections away from hard boundaries. */
function forecastClamp(n: number): number {
  return Math.max(10, Math.min(95, Math.round(n)));
}

/**
 * Returns 21 data points: 14 historical days (oldest → today) followed by
 * 7 forecast days (tomorrow → +7).
 *
 * Forecast is a simple linear projection: the same per-day slope observed
 * over the last 7 historical days, extended for 7 more days.
 * All forecast values are clamped to [10, 95].
 */
export function getMockTrendData(): TrendDataPoint[] {
  const today = new Date();
  const data: TrendDataPoint[] = [];

  /* ── 14 historical days ── */
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const dow = d.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const idx = 13 - i; // 0 = oldest, 13 = today

    const health   = clamp(Math.round(65 + idx * 0.5 + (isWeekend ? 3 : 0) + Math.sin(idx * 0.8) * 2));
    const workLife = clamp(Math.round(56 - idx * 0.6 + (isWeekend ? 8 : 0) + Math.cos(idx * 0.7) * 2));
    const social   = clamp(Math.round(63 + (isWeekend ? 6 : -1) + Math.sin(idx * 1.2) * 3));
    const purpose  = clamp(Math.round(62 - idx * 0.3 + Math.sin(idx * 0.5) * 3));
    const sleep    = clamp(Math.round(62 - idx * 0.5 + (isWeekend ? 4 : 0) + Math.cos(idx * 0.9) * 2));
    const overall  = clamp(Math.round(health * 0.25 + workLife * 0.25 + social * 0.2 + purpose * 0.15 + sleep * 0.15));

    data.push({ date, isForecast: false, overall, health, workLife, social, purpose, sleep });
  }

  /* ── 7-day linear forecast ──
     slope = (today_value − 7_days_ago_value) / 7
     The "7 days ago" point is data[6] (index 13 − 7 = 6). */
  const last  = data[data.length - 1];  // today
  const week  = data[data.length - 8];  // 7 days ago (data[6])

  const slope = {
    health:   (last.health   - week.health)   / 7,
    workLife: (last.workLife - week.workLife) / 7,
    social:   (last.social   - week.social)   / 7,
    purpose:  (last.purpose  - week.purpose)  / 7,
    sleep:    (last.sleep    - week.sleep)    / 7,
    overall:  (last.overall  - week.overall)  / 7,
  };

  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    const date = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    const health   = forecastClamp(last.health   + slope.health   * i);
    const workLife = forecastClamp(last.workLife + slope.workLife * i);
    const social   = forecastClamp(last.social   + slope.social   * i);
    const purpose  = forecastClamp(last.purpose  + slope.purpose  * i);
    const sleep    = forecastClamp(last.sleep    + slope.sleep    * i);
    const overall  = forecastClamp(last.overall  + slope.overall  * i);

    data.push({ date, isForecast: true, overall, health, workLife, social, purpose, sleep });
  }

  return data;
}

/* ─── Per-user dashboard data ─── */

// userId is a placeholder for when scores become per-user
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getMockDashboardData(_userId: string): MockDashboardData {
  return {
    verticalScores: [
      {
        vertical: WellbeingVertical.HEALTH,
        score: 72,
        trend: 5,
        trendDays: [63, 65, 67, 68, 70, 71, 72],
      },
      {
        vertical: WellbeingVertical.WORK_LIFE,
        score: 48,
        trend: -8,
        trendDays: [56, 55, 54, 52, 50, 49, 48],
      },
      {
        vertical: WellbeingVertical.SOCIAL,
        score: 65,
        trend: 2,
        trendDays: [63, 63, 62, 64, 63, 65, 65],
      },
      {
        vertical: WellbeingVertical.PURPOSE,
        score: 58,
        trend: -3,
        trendDays: [61, 60, 60, 59, 59, 58, 58],
      },
      {
        vertical: WellbeingVertical.SLEEP,
        score: 55,
        trend: -6,
        trendDays: [61, 60, 59, 58, 57, 56, 55],
      },
    ],
  };
}
