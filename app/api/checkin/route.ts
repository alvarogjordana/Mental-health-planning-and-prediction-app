import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WellbeingVertical } from "@/types";

/* Map the primary driver label to the most relevant wellbeing vertical */
const DRIVER_TO_VERTICAL: Record<string, WellbeingVertical> = {
  "Sleep":                    WellbeingVertical.SLEEP,
  "Exercise":                 WellbeingVertical.HEALTH,
  "Social time":              WellbeingVertical.SOCIAL,
  "Work / calendar":          WellbeingVertical.WORK_LIFE,
  "Mental load":              WellbeingVertical.WORK_LIFE,
  "Weather & environment":    WellbeingVertical.HEALTH,
  "Sense of progress":        WellbeingVertical.PURPOSE,
  "Relationships":            WellbeingVertical.SOCIAL,
};

/* Midnight-bounded range for "today" queries */
function todayRange(): { gte: Date; lt: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { gte: start, lt: end };
}

/* ── GET /api/checkin ─────────────────────────────────────────────────
   Returns whether the user has already logged a check-in today.
   If yes, includes the mood label and score for the confirmation screen. */
export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json({ alreadyDone: false });
  }

  const range = todayRange();
  const log = await prisma.moodLog.findFirst({
    where: { userId: user.id, date: range },
  });

  if (!log) {
    return NextResponse.json({ alreadyDone: false });
  }

  // Parse the mood answer out of the stored JSON
  const answers = JSON.parse(log.answers) as Array<{ questionId: string; answer: string }>;
  const mood = answers.find((a) => a.questionId === "mood")?.answer ?? "";
  const moodScore = Math.round(log.overallScore / 20); // reverse: score 0-100 → 1-5

  return NextResponse.json({ alreadyDone: true, mood, moodScore });
}

/* ── POST /api/checkin ────────────────────────────────────────────────
   Saves the check-in: creates a MoodLog and upserts a VerticalScore
   for the vertical that maps to the selected primary driver. */
export async function POST(request: NextRequest) {
  try {
    const { mood, moodScore, sleepHours, exercised, primaryDriver, reflection } = await request.json() as {
      mood: string;
      moodScore: number;
      sleepHours: number | null;
      exercised: boolean | null;
      primaryDriver: string;
      reflection: string;
    };

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const overallScore = moodScore * 20; // 1–5 → 20–100
    const now = new Date();

    /* Create the MoodLog */
    await prisma.moodLog.create({
      data: {
        userId: user.id,
        date: now,
        answers: JSON.stringify([
          { questionId: "mood",          question: "How are you feeling right now?",              answer: mood },
          { questionId: "sleepHours",    question: "How many hours did you sleep last night?",    answer: sleepHours !== null ? String(sleepHours) : "" },
          { questionId: "exercised",     question: "Did you exercise today?",                     answer: exercised !== null ? (exercised ? "yes" : "no") : "" },
          { questionId: "primaryDriver", question: "What's shaping your mood the most today?",    answer: primaryDriver },
          { questionId: "reflection",    question: "Anything you want to note about today?",      answer: reflection },
        ]),
        overallScore,
      },
    });

    const range = todayRange();

    /* Upsert SLEEP vertical score from reported sleep hours */
    if (sleepHours !== null) {
      const sleepScore = Math.min(100, Math.max(0,
        sleepHours >= 8 ? 100 :
        sleepHours >= 7 ? Math.round(70 + (sleepHours - 7) * 30) :
        sleepHours >= 6 ? Math.round(45 + (sleepHours - 6) * 25) :
        Math.round(sleepHours * 7.5)
      ));
      const existing = await prisma.verticalScore.findFirst({
        where: { userId: user.id, vertical: WellbeingVertical.SLEEP, date: range },
      });
      const sourceData = JSON.stringify({ source: "checkin", sleepHours });
      if (existing) {
        await prisma.verticalScore.update({ where: { id: existing.id }, data: { score: sleepScore, sourceData } });
      } else {
        await prisma.verticalScore.create({ data: { userId: user.id, date: range.gte, vertical: WellbeingVertical.SLEEP, score: sleepScore, sourceData } });
      }
    }

    /* Upsert HEALTH vertical score from sleep + exercise */
    if (sleepHours !== null || exercised !== null) {
      const sleepComponent = sleepHours !== null
        ? Math.min(100, sleepHours >= 8 ? 100 : sleepHours >= 7 ? Math.round(70 + (sleepHours - 7) * 30) : sleepHours >= 6 ? Math.round(45 + (sleepHours - 6) * 25) : Math.round(sleepHours * 7.5))
        : 60; // neutral fallback if not provided
      const exerciseBonus = exercised === true ? 20 : exercised === false ? 0 : 0;
      const healthScore = Math.min(100, Math.round(sleepComponent * 0.8 + exerciseBonus));
      const existing = await prisma.verticalScore.findFirst({
        where: { userId: user.id, vertical: WellbeingVertical.HEALTH, date: range },
      });
      const sourceData = JSON.stringify({ source: "checkin", sleepHours, exercised });
      if (existing) {
        await prisma.verticalScore.update({ where: { id: existing.id }, data: { score: healthScore, sourceData } });
      } else {
        await prisma.verticalScore.create({ data: { userId: user.id, date: range.gte, vertical: WellbeingVertical.HEALTH, score: healthScore, sourceData } });
      }
    }

    /* Upsert the VerticalScore for the primary driver vertical */
    const targetVertical = DRIVER_TO_VERTICAL[primaryDriver];
    if (targetVertical) {
      const existing = await prisma.verticalScore.findFirst({
        where: { userId: user.id, vertical: targetVertical, date: range },
      });

      const sourceData = JSON.stringify({ source: "checkin", primaryDriver, moodScore });

      if (existing) {
        await prisma.verticalScore.update({
          where: { id: existing.id },
          data: { score: overallScore, sourceData },
        });
      } else {
        await prisma.verticalScore.create({
          data: {
            userId: user.id,
            date: range.gte,
            vertical: targetVertical,
            score: overallScore,
            sourceData,
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/checkin error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
