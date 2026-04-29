import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/history
 * Returns all MoodLog records for the current user, newest first.
 * Each record includes the parsed answers array and overallScore.
 */
export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user) {
    return NextResponse.json({ logs: [] });
  }

  const moodLogs = await prisma.moodLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  const logs = moodLogs.map((log) => {
    let answers: Array<{ questionId: string; answer: string }> = [];
    try {
      answers = JSON.parse(log.answers);
    } catch {
      // malformed JSON — return empty answers
    }
    return {
      id: log.id,
      date: log.date,
      answers,
      overallScore: log.overallScore,
    };
  });

  return NextResponse.json({ logs });
}
