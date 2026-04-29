import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { WellbeingVertical, VerticalWeight } from "@/types";

const RANK_WEIGHTS = [0.30, 0.25, 0.20, 0.15, 0.10];

function computeWeights(ranking: WellbeingVertical[]): VerticalWeight {
  return ranking.reduce((acc, vertical, i) => {
    acc[vertical] = RANK_WEIGHTS[i] ?? 0.10;
    return acc;
  }, {} as VerticalWeight);
}

/* ── GET /api/profile ─────────────────────────────────────────────────
   Returns the current user's full profile, parsed into friendly fields. */
export async function GET() {
  const user = await prisma.user.findFirst();
  if (!user) return NextResponse.json({ error: "No user found" }, { status: 404 });

  const [introvertExtrovert = "", decisionStyle = ""] =
    (user.personalityNotes ?? "").split("|");
  const priorities: string[] = user.priorities ? JSON.parse(user.priorities) : [];

  return NextResponse.json({
    name: user.name,
    location: user.location ?? "Boston",
    lifeStage: user.lifeStage ?? "",
    energizers: user.energizers ? (JSON.parse(user.energizers) as string[]) : [],
    drainers: user.drainers ? (JSON.parse(user.drainers) as string[]) : [],
    introvertExtrovert,
    decisionStyle,
    verticalWeights: user.verticalWeights
      ? (JSON.parse(user.verticalWeights) as Record<string, number>)
      : {},
    oneGoal: priorities[0] ?? "",
    calendarsConnected: {
      casa:    !!process.env.ICAL_CASA_URL,
      outlook: !!process.env.ICAL_OUTLOOK_URL,
    },
  });
}

/* ── POST /api/profile ────────────────────────────────────────────────
   Full onboarding save — creates or replaces the user record. */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      name: string;
      lifeStage: string;
      energizers: string[];
      drainers: string[];
      introvertExtrovert: string;
      decisionStyle: string;
      verticalRanking: WellbeingVertical[];
      oneGoal: string;
    };

    const weights = computeWeights(body.verticalRanking);

    const data = {
      name: body.name.trim(),
      lifeStage: body.lifeStage ?? "",
      personalityNotes: [body.introvertExtrovert, body.decisionStyle].join("|"),
      priorities: JSON.stringify([body.oneGoal]),
      energizers: JSON.stringify(body.energizers),
      drainers: JSON.stringify(body.drainers),
      verticalWeights: JSON.stringify(weights),
    };

    const existing = await prisma.user.findFirst();
    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data });

    return NextResponse.json({ id: user.id });
  } catch (err) {
    console.error("POST /api/profile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ── PATCH /api/profile ───────────────────────────────────────────────
   Partial update from the profile edit page.
   Vertical weights are NOT updatable here (only via full onboarding). */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json() as {
      name?: string;
      location?: string;
      lifeStage?: string;
      energizers?: string[];
      drainers?: string[];
      introvertExtrovert?: string;
      decisionStyle?: string;
      oneGoal?: string;
    };

    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "No user found" }, { status: 404 });

    const data: Record<string, string> = {};

    if (body.name !== undefined) data.name = body.name.trim();
    if (body.location !== undefined) data.location = body.location.trim();
    if (body.lifeStage !== undefined) data.lifeStage = body.lifeStage;
    if (body.energizers !== undefined) data.energizers = JSON.stringify(body.energizers);
    if (body.drainers !== undefined) data.drainers = JSON.stringify(body.drainers);
    if (body.oneGoal !== undefined) data.priorities = JSON.stringify([body.oneGoal]);

    if (body.introvertExtrovert !== undefined || body.decisionStyle !== undefined) {
      const [curIntrovert = "", curDecision = ""] = (user.personalityNotes ?? "").split("|");
      data.personalityNotes = [
        body.introvertExtrovert ?? curIntrovert,
        body.decisionStyle ?? curDecision,
      ].join("|");
    }

    await prisma.user.update({ where: { id: user.id }, data });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
