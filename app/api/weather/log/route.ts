import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logTodayWeather } from "@/lib/integrations/weather";

/**
 * GET /api/weather/log
 * Returns the last 7 WeatherLog records for the current user.
 */
export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ logs: [] });

  const logs = await prisma.weatherLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 7,
  });

  return NextResponse.json({ logs });
}

/**
 * POST /api/weather/log
 * Fetches the current weather for the user's city and upserts today's WeatherLog.
 * Called fire-and-forget from the dashboard — response body is not checked.
 */
export async function POST() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "No API key configured" }, { status: 400 });
  }

  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "No user found" }, { status: 404 });

  await logTodayWeather(user.id, user.location ?? "Boston", key);
  return NextResponse.json({ success: true });
}
