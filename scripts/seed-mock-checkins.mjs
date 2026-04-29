/**
 * Seeds 14 days of realistic mock check-in data into Turso.
 * Run with: npm run db:seed
 * Pass --clean to wipe existing mock data first.
 */

import https from "https";

const TURSO_URL   = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set.");
  process.exit(1);
}

const HOST = TURSO_URL.replace(/^libsql:\/\//, "");
const CLEAN = process.argv.includes("--clean");

function genId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

async function turso(statements) {
  const body = JSON.stringify({
    requests: [
      ...statements.map((sql) => ({ type: "execute", stmt: { sql } })),
      { type: "close" },
    ],
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: HOST,
        path: "/v2/pipeline",
        method: "POST",
        headers: {
          Authorization: "Bearer " + TURSO_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          const parsed = JSON.parse(d);
          const errors = parsed.results?.filter((r) => r.type === "error");
          if (errors?.length) reject(new Error(errors[0].error?.message));
          else resolve(parsed.results);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function query(sql) {
  const body = JSON.stringify({
    requests: [{ type: "execute", stmt: { sql } }, { type: "close" }],
  });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: HOST,
        path: "/v2/pipeline",
        method: "POST",
        headers: {
          Authorization: "Bearer " + TURSO_TOKEN,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => resolve(JSON.parse(d)));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Score helpers (must match the formulas in route.ts / data/page.tsx) ──

function sleepScore(h) {
  if (h >= 8)  return 100;
  if (h >= 7)  return Math.round(70 + (h - 7) * 30);
  if (h >= 6)  return Math.round(45 + (h - 6) * 25);
  return Math.round(h * 7.5);
}

function healthScore(slScore, exercised) {
  return Math.min(100, Math.round(slScore * 0.8 + (exercised ? 20 : 0)));
}

function workLifeScore(moodPct, isWeekend, driver) {
  const base = isWeekend ? 75 : 55;
  const mod =
    driver === "Work / calendar"  ? -10 :
    driver === "Mental load"      ? -8  :
    driver === "Sense of progress"? +12 : 0;
  return Math.min(95, Math.max(20, base + mod + Math.round((moodPct - 60) * 0.15)));
}

function socialScore(moodPct, isWeekend, driver) {
  const mod =
    driver === "Social time"   ? 20 :
    driver === "Relationships" ? 15 : 0;
  const weekendBonus = isWeekend ? 8 : 0;
  return Math.min(95, Math.max(20, 55 + mod + weekendBonus + Math.round((moodPct - 60) * 0.12)));
}

function purposeScore(moodPct, driver) {
  const mod =
    driver === "Sense of progress" ? 15 :
    driver === "Exercise"          ? 8  : 0;
  return Math.min(95, Math.max(20, 60 + mod + Math.round((moodPct - 60) * 0.18)));
}

// ── 14-day mock data (day -14 to day -1) ──
// Format: [moodLabel, moodScore(1-5), sleepHours, exercised, driver, reflection]

const DAYS = [
  ["Good",  4, 7.0, true,  "Sense of progress", "EC had a great case discussion today"],
  ["Okay",  3, 6.5, false, "Work / calendar",   "Back to back classes and recruiting prep"],
  ["Good",  4, 7.0, true,  "Sense of progress", "FIELD project making good progress"],
  ["Great", 5, 8.5, true,  "Social time",       "Great dinner with section mates"],
  ["Okay",  3, 8.0, false, "Mental load",       "Case prep for the week, a bit anxious"],
  ["Okay",  3, 6.5, true,  "Work / calendar",   "Tough start to the week"],
  ["Good",  4, 7.0, false, "Sense of progress", "Good cold call in Finance today"],
  ["Good",  4, 7.0, true,  "Exercise",          "Morning run helped clear my head"],
  ["Okay",  3, 6.0, false, "Mental load",       "A lot on my plate right now"],
  ["Great", 5, 7.5, true,  "Sense of progress", "Finished two major deliverables"],
  ["Great", 5, 8.5, true,  "Social time",       "Amazing day out — needed this"],
  ["Good",  4, 8.0, false, "Relationships",     "Good call with family back home"],
  ["Okay",  3, 6.5, true,  "Work / calendar",   "Heavy week ahead, feeling the pressure"],
  ["Good",  4, 7.0, false, "Sense of progress", "Made good progress on RC project"],
];

// ── Main ──

const today = new Date();
today.setHours(0, 0, 0, 0);

// Get user
const userResult = await query('SELECT id FROM "User" LIMIT 1');
const userId = userResult.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
if (!userId) {
  console.error("No user found in Turso. Complete onboarding first.");
  process.exit(1);
}
console.log("User:", userId);

if (CLEAN) {
  console.log("Cleaning existing mock data...");
  await turso([
    `DELETE FROM "MoodLog" WHERE "userId" = '${userId}' AND "id" LIKE 'mock_%'`,
    `DELETE FROM "VerticalScore" WHERE "userId" = '${userId}' AND "id" LIKE 'mock_%'`,
  ]);
}

// Vertical weight defaults (PURPOSE 0.30, HEALTH 0.25, WORK_LIFE 0.20, SOCIAL 0.15, SLEEP 0.10)
const wResult = await query(`SELECT "verticalWeights" FROM "User" WHERE "id" = '${userId}'`);
const wRaw = wResult.results?.[0]?.response?.result?.rows?.[0]?.[0]?.value;
const weights = wRaw ? JSON.parse(wRaw) : {
  PURPOSE: 0.30, HEALTH: 0.25, WORK_LIFE: 0.20, SOCIAL: 0.15, SLEEP: 0.10,
};

const inserts = [];

for (let i = 0; i < DAYS.length; i++) {
  const [moodLabel, moodNum, sleepHrs, exercised, driver, reflection] = DAYS[i];
  const daysAgo = DAYS.length - i; // 14 down to 1

  const d = new Date(today);
  d.setDate(d.getDate() - daysAgo);
  d.setHours(20, 0, 0, 0); // 8pm check-in
  const dateISO = d.toISOString();

  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
  const moodPct   = moodNum * 20;
  const overallScore = moodPct;

  const answers = JSON.stringify([
    { questionId: "mood",          question: "How are you feeling right now?",              answer: moodLabel },
    { questionId: "sleepHours",    question: "How many hours did you sleep last night?",    answer: String(sleepHrs) },
    { questionId: "exercised",     question: "Did you exercise today?",                     answer: exercised ? "yes" : "no" },
    { questionId: "primaryDriver", question: "What's shaping your mood the most today?",    answer: driver },
    { questionId: "reflection",    question: "Anything you want to note about today?",      answer: reflection },
  ]).replace(/'/g, "''");

  const mlId = `mock_ml_${i}_${genId()}`;
  inserts.push(
    `INSERT OR IGNORE INTO "MoodLog" ("id","userId","date","answers","overallScore") VALUES ('${mlId}','${userId}','${dateISO}','${answers}',${overallScore})`
  );

  // Vertical scores
  const sl = sleepScore(sleepHrs);
  const hl = healthScore(sl, exercised);
  const wl = workLifeScore(moodPct, isWeekend, driver);
  const so = socialScore(moodPct, isWeekend, driver);
  const pu = purposeScore(moodPct, driver);

  const verticals = [
    ["SLEEP",     sl],
    ["HEALTH",    hl],
    ["WORK_LIFE", wl],
    ["SOCIAL",    so],
    ["PURPOSE",   pu],
  ];

  for (const [vertical, score] of verticals) {
    const vsId = `mock_vs_${i}_${vertical}_${genId()}`;
    inserts.push(
      `INSERT OR IGNORE INTO "VerticalScore" ("id","userId","date","vertical","score","sourceData") VALUES ('${vsId}','${userId}','${dateISO}','${vertical}',${score},'{"source":"mock"}')`
    );
  }
}

console.log(`Inserting ${inserts.length} records...`);

// Send in batches of 20
for (let i = 0; i < inserts.length; i += 20) {
  await turso(inserts.slice(i, i + 20));
}

console.log("✓ Seeded 14 days of mock check-in data.");
