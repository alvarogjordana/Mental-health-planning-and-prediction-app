/**
 * AI assessment engine — Anthropic Claude (claude-haiku-4-5-20251001)
 * Server-only module — never import from client components.
 * API key: ANTHROPIC_API_KEY in .env.local
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { getMockDashboardData } from "@/lib/mock-dashboard";
import { getHealthData } from "@/lib/integrations/health";
import { getCalendarData, type CalendarData } from "@/lib/integrations/calendar";
import { getWeatherData, type WeatherData } from "@/lib/integrations/weather";
import { getPhoneUsageData } from "@/lib/integrations/phoneUsage";
import { WellbeingVertical } from "@/types";

/* ─── Output shape (spec-aligned) ─────────────────────────────────── */

export interface AssessmentResult {
  overallNarrative: string;
  verticalInsights: {
    vertical: string;
    insight: string;
    score: number;
  }[];
  forecast: string;
  suggestions: {
    category: "stop" | "start" | "continue";
    action: string;
    reasoning: string;
  }[];
  weekScore: number;
}

/* ─── Fallback (returned when API key missing or call fails) ───────── */

export const FALLBACK_ASSESSMENT: AssessmentResult = {
  overallNarrative:
    "Assessment temporarily unavailable. Please try again shortly.",
  verticalInsights: Object.values(WellbeingVertical).map((v) => ({
    vertical: v,
    insight: "More check-in data is needed before we can generate a specific insight here.",
    score: 50,
  })),
  forecast:
    "Keep logging daily check-ins to unlock a personalized forecast based on your actual trends.",
  suggestions: [
    {
      category: "stop",
      action: "Going to bed with your phone nearby",
      reasoning:
        "Screen exposure before sleep is consistently linked to reduced sleep quality.",
    },
    {
      category: "start",
      action: "A 10-minute walk before your first meeting",
      reasoning:
        "Light movement in the morning anchors your mood and improves focus for the first hour of work.",
    },
    {
      category: "continue",
      action: "Logging your daily check-ins",
      reasoning:
        "Consistency is what turns individual data points into meaningful patterns over time.",
    },
  ],
  weekScore: 50,
};

/* ─── Internal types for prompt building ──────────────────────────── */

interface ProfileData {
  name: string;
  energizers: string[];
  drainers: string[];
  introvertLabel: string;
  decisionLabel: string;
  oneGoal: string;
  weights: Record<string, number>;
}

interface ContextData {
  moodLogs: {
    date: string;
    mood: string;
    moodScore: number;
    primaryDriver: string;
    reflection: string;
  }[];
  verticals: { vertical: string; score: number; trend: number; weight: number }[];
  health: { avgSteps: number; avgCalories: number; avgWorkoutMins: number };
  calendar: CalendarData | null;
  weather: WeatherData | null;
  phone: { avgScreenMins: number; avgPickups: number; avgSocialMins: number };
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

export function getWeekStart(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function numAvg(arr: number[]): number {
  return arr.length === 0
    ? 0
    : Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

const INTROVERT_LABELS: Record<string, string> = {
  introvert: "Recharges alone (introvert)",
  extrovert: "Recharges with others (extrovert)",
  depends: "Flexible recharger — depends on context",
};
const DECISION_LABELS: Record<string, string> = {
  logic: "Makes decisions with logic and data",
  gut: "Makes decisions with gut feeling and values",
  mix: "Balances logic and intuition",
};
const VERTICAL_NAMES: Record<string, string> = {
  HEALTH: "Health & Fitness",
  WORK_LIFE: "Work-Life Balance",
  SOCIAL: "Social Connection",
  PURPOSE: "Sense of Purpose",
  SLEEP: "Sleep & Energy",
};

/* ─── Prompt builder ───────────────────────────────────────────────── */

export function buildAssessmentPrompt(
  profile: ProfileData,
  data: ContextData
): string {
  const SYSTEM = `You are Freedom, a personal mental wellness assistant. Your job is to analyse a user's wellbeing data and generate a warm, honest, and highly personalized weekly assessment. You are direct but kind — like a trusted coach who knows this person well. You never give generic advice. Every suggestion must be specific to this person's profile, data, and goals.`;

  const weightLines = Object.entries(profile.weights)
    .sort(([, a], [, b]) => b - a)
    .map(([v, w]) => `  ${VERTICAL_NAMES[v] ?? v}: ${Math.round(w * 100)}%`)
    .join("\n");

  const moodLines =
    data.moodLogs.length > 0
      ? data.moodLogs
          .map(
            (m) =>
              `  [${m.date}] ${m.mood} (${m.moodScore * 20}/100)` +
              ` | Driver: ${m.primaryDriver}` +
              (m.reflection ? ` | Note: "${m.reflection}"` : "")
          )
          .join("\n")
      : "  No check-ins logged this week.";

  const verticalLines = data.verticals
    .map(
      (v) =>
        `  ${VERTICAL_NAMES[v.vertical] ?? v.vertical}: ` +
        `${v.score}/100 (${v.trend >= 0 ? "+" : ""}${v.trend} vs last week, ` +
        `weight ${Math.round(v.weight * 100)}%)`
    )
    .join("\n");

  const USER_MSG = `## User profile
Name: ${profile.name}
What energises them: ${profile.energizers.join(", ") || "not specified"}
What drains them: ${profile.drainers.join(", ") || "not specified"}
Personality: ${profile.introvertLabel}; ${profile.decisionLabel}
Their goal (what they most want to feel more of): ${profile.oneGoal || "not specified"}
Vertical priority weights (higher = more important to this person):
${weightLines}

## Mood check-ins this week (newest first)
${moodLines}

## Vertical scores this week
${verticalLines}

## Health data (7-day average)
Steps per day: ${data.health.avgSteps.toLocaleString()}
Active calories: ${data.health.avgCalories}
Workout minutes: ${data.health.avgWorkoutMins}

${data.calendar ? `## Calendar data (last 7 days)
- Avg meetings/day: ${data.calendar.summary.avgMeetingsPerDay}
- Avg meeting time/day: ${data.calendar.summary.avgMeetingMinutesPerDay} minutes
- Avg free blocks/day (30+ min): ${data.calendar.summary.avgFreeBlocksPerDay}
- Busiest day: ${data.calendar.summary.busiestDay}
- Social events this week: ${data.calendar.summary.totalSocialEvents}
- Exercise sessions logged in calendar: ${data.calendar.summary.totalExerciseEvents}
- Today's remaining events: ${data.calendar.summary.upcomingToday.map(e => e.title).join(", ") || "none"}` : "## Calendar data\n  Not available for this assessment."}

${data.weather ? `## Weather context (${data.weather.current.city})
Current: ${data.weather.current.tempF}°F, ${data.weather.current.condition} (${data.weather.current.description}), ${data.weather.current.humidity}% humidity, wind ${data.weather.current.windMph} mph
Last 7 days:
${data.weather.last7Days.map((d) => `  ${d.date}: ${d.tempF}°F, ${d.condition}, ${d.humidity}% humidity`).join("\n")}
${data.weather.next5Days.length > 0 ? `Next 5 days forecast:\n${data.weather.next5Days.map((d) => `  ${d.date}: ${d.tempF}°F, ${d.condition}`).join("\n")}` : ""}
Note: Factor weather into your assessment of energy, outdoor activity likelihood, and mood context. If there have been multiple consecutive grey or rainy days, acknowledge this as a likely contributor to any energy or purpose dips. If good weather is forecast, consider mentioning outdoor activity in your suggestions where relevant to this user's profile.` : "## Weather context\n  Not available for this assessment."}

## Phone usage (7-day average)
Daily screen time: ${data.phone.avgScreenMins} min
Pickups per day: ${data.phone.avgPickups}
Social media: ${data.phone.avgSocialMins} min/day

## Instructions
Return ONLY a valid JSON object. No markdown fences. No preamble. No trailing text.
Be specific — reference their actual numbers and named data points.
Every suggestion action must be under 12 words.

{
  "overallNarrative": "<2–3 sentences summarising the week honestly and personally>",
  "verticalInsights": [
    { "vertical": "HEALTH",    "insight": "<1 sentence grounded in their health data>",    "score": 0 },
    { "vertical": "WORK_LIFE", "insight": "<1 sentence grounded in calendar and mood data>", "score": 0 },
    { "vertical": "SOCIAL",    "insight": "<1 sentence>",  "score": 0 },
    { "vertical": "PURPOSE",   "insight": "<1 sentence>",  "score": 0 },
    { "vertical": "SLEEP",     "insight": "<1 sentence grounded in sleep and phone data>", "score": 0 }
  ],
  "forecast": "<1–2 sentences: where they are headed if this week's trend continues>",
  "suggestions": [
    { "category": "stop",     "action": "<specific behaviour to stop, under 12 words>",    "reasoning": "<1 sentence tied to their data>" },
    { "category": "start",    "action": "<specific behaviour to start, under 12 words>",   "reasoning": "<1 sentence tied to their data>" },
    { "category": "continue", "action": "<specific behaviour to continue, under 12 words>","reasoning": "<1 sentence tied to their data>" }
  ],
  "weekScore": 0
}

Fill each score (0–100) using the vertical data provided.
weekScore = weighted average across all five verticals using the priority weights above.`;

  return `${SYSTEM}\n\n${USER_MSG}`;
}

/* ─── Data gathering ───────────────────────────────────────────────── */

async function gatherData(userId: string): Promise<{ profile: ProfileData; context: ContextData } | null> {
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) return null;

  // Parse stored profile fields
  const energizers: string[] = user.energizers ? JSON.parse(user.energizers) : [];
  const drainers: string[] = user.drainers ? JSON.parse(user.drainers) : [];
  const priorities: string[] = user.priorities ? JSON.parse(user.priorities) : [];
  const oneGoal = priorities[0] ?? "";
  const [introvertRaw = "", decisionRaw = ""] = (user.personalityNotes ?? "").split("|");
  const weights: Record<string, number> = user.verticalWeights
    ? JSON.parse(user.verticalWeights)
    : Object.fromEntries(Object.values(WellbeingVertical).map((v) => [v, 0.2]));

  const profile: ProfileData = {
    name: user.name,
    energizers,
    drainers,
    introvertLabel: INTROVERT_LABELS[introvertRaw] ?? introvertRaw,
    decisionLabel: DECISION_LABELS[decisionRaw] ?? decisionRaw,
    oneGoal,
    weights,
  };

  // Fetch last 7 days of MoodLogs
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const moodLogRows = await prisma.moodLog.findMany({
    where: { userId, date: { gte: sevenDaysAgo } },
    orderBy: { date: "desc" },
  });

  const moodLogs = moodLogRows.map((log) => {
    const answers = JSON.parse(log.answers) as { questionId: string; answer: string }[];
    const get = (id: string) => answers.find((a) => a.questionId === id)?.answer ?? "";
    return {
      date: new Date(log.date).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      mood: get("mood"),
      moodScore: Math.round(log.overallScore / 20),
      primaryDriver: get("primaryDriver"),
      reflection: get("reflection"),
    };
  });

  // Vertical scores from mock dashboard data (source of truth for current week)
  const { verticalScores } = getMockDashboardData(userId);
  const verticals = verticalScores.map((vs) => ({
    vertical: vs.vertical as string,
    score: vs.score,
    trend: vs.trend,
    weight: weights[vs.vertical] ?? 0.2,
  }));

  // Integration data (calendar + weather use real APIs; others remain mock)
  let calendarData: CalendarData | null = null;
  const [healthData, weatherData, phoneData] = await Promise.all([
    getHealthData(7),
    getWeatherData(userId),
    getPhoneUsageData(7),
  ]);
  try { calendarData = await getCalendarData(); } catch (err) {
    console.warn("getCalendarData failed in gatherData:", err);
  }

  const context: ContextData = {
    moodLogs,
    verticals,
    health: {
      avgSteps: numAvg(healthData.map((d) => d.steps)),
      avgCalories: numAvg(healthData.map((d) => d.activeCalories)),
      avgWorkoutMins: numAvg(healthData.map((d) => d.workoutMinutes)),
    },
    calendar: calendarData,
    weather: weatherData,
    phone: {
      avgScreenMins: numAvg(phoneData.map((d) => d.totalScreenMinutes)),
      avgPickups: numAvg(phoneData.map((d) => d.pickups)),
      avgSocialMins: numAvg(phoneData.map((d) => d.socialMediaMinutes)),
    },
  };

  return { profile, context };
}

/* ─── generateWeeklyAssessment ─────────────────────────────────────── */

export async function generateWeeklyAssessment(
  userId: string
): Promise<AssessmentResult> {
  console.log("API KEY LOADED:", (process.env.ANTHROPIC_API_KEY ?? "").slice(0, 10));
  const gathered = await gatherData(userId);
  if (!gathered) {
    console.error("generateWeeklyAssessment: user not found for id", userId);
    return FALLBACK_ASSESSMENT;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn("ANTHROPIC_API_KEY is not set in .env.local — returning fallback assessment");
    return FALLBACK_ASSESSMENT;
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const prompt = buildAssessmentPrompt(gathered.profile, gathered.context);
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (message.content[0] as { text: string }).text;
    const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const assessment = JSON.parse(cleaned) as AssessmentResult;

    // Persist to DB
    const weekStart = getWeekStart();
    await prisma.weeklyReport.create({
      data: {
        userId,
        weekStartDate: weekStart,
        summaryText: assessment.overallNarrative,
        suggestions: JSON.stringify(assessment), // full assessment stored here
      },
    });

    return assessment;
  } catch (err) {
    console.error("generateWeeklyAssessment error:", err);
    return FALLBACK_ASSESSMENT;
  }
}

/* ─── getOrGenerateAssessment (cached wrapper) ─────────────────────── */

export async function getOrGenerateAssessment(
  userId: string
): Promise<AssessmentResult> {
  try {
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const existing = await prisma.weeklyReport.findFirst({
      where: {
        userId,
        weekStartDate: { gte: weekStart, lt: weekEnd },
      },
    });

    if (existing) {
      // suggestions column holds the full assessment JSON
      return JSON.parse(existing.suggestions) as AssessmentResult;
    }

    return await generateWeeklyAssessment(userId);
  } catch (err) {
    console.error("getOrGenerateAssessment error:", err);
    return FALLBACK_ASSESSMENT;
  }
}
