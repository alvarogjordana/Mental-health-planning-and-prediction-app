import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateWeeklyAssessment, getWeekStart } from "@/lib/ai";

export async function POST() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    // Delete this week's cached report so generateWeeklyAssessment creates a fresh one
    const weekStart = getWeekStart();
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    await prisma.weeklyReport.deleteMany({
      where: {
        userId: user.id,
        weekStartDate: { gte: weekStart, lt: weekEnd },
      },
    });

    const assessment = await generateWeeklyAssessment(user.id);
    return NextResponse.json(assessment);
  } catch (err) {
    console.error("POST /api/assessment/refresh error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
