/**
 * Calendar integration — iCal feeds (iCloud + Outlook)
 * Server-only module. Feed URLs come from .env.local, never exposed to the browser.
 */

import Anthropic from "@anthropic-ai/sdk";

/* ─── Public types ─── */

export type EventType = "meeting" | "social" | "exercise" | "travel" | "other";

export interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  durationMinutes: number;
  isAllDay: boolean;
  calendar: "casa" | "outlook";
  type: EventType;
}

export interface DayMetrics {
  date: string;              // "Apr 14"
  totalEvents: number;
  meetingCount: number;
  meetingMinutes: number;
  socialEvents: number;
  exerciseEvents: number;
  freeBlocks: number;        // 30-min slots free between 9am–6pm
  calendarDensity: number;   // 0–100: % of 9am–6pm covered by events
  longestMeetingStretch: number; // longest consecutive meeting block (minutes)
  totalBlockedMinutes: number;   // sum of all non-all-day event durations
  workMinutes: number;           // meeting + travel events
  socialMinutes: number;         // social events
  personalMinutes: number;       // exercise + other events
}

export interface CalendarData {
  last7Days: DayMetrics[];
  summary: {
    avgMeetingsPerDay: number;
    avgMeetingMinutesPerDay: number;
    avgFreeBlocksPerDay: number;
    busiestDay: string;
    mostProductiveDay: string;
    totalSocialEvents: number;
    totalExerciseEvents: number;
    upcomingToday: CalendarEvent[];
  };
}

/* ─── Feed definitions ─── */

const FEEDS: { name: CalendarEvent["calendar"]; url: string | undefined }[] = [
  { name: "casa",    url: process.env.ICAL_CASA_URL    },
  { name: "outlook", url: process.env.ICAL_OUTLOOK_URL },
];

/* ─── Helpers ─── */

function classifyEvent(title: string): EventType {
  const t = title.toLowerCase();
  if (
    t.includes("meeting") || t.includes("call")   || t.includes("sync") ||
    t.includes("standup") || t.includes("interview") || t.includes("review") ||
    t.includes("reunión") || t.includes("llamada")
  ) return "meeting";
  if (
    t.includes("lunch")   || t.includes("dinner") || t.includes("cena") ||
    t.includes("breakfast") || t.includes("coffee") || t.includes("café")
  ) return "social";
  if (
    t.includes("gym")     || t.includes("run")    || t.includes("workout") ||
    t.includes("yoga")    || t.includes("exercise") || t.includes("sport")
  ) return "exercise";
  if (
    t.includes("flight")  || t.includes("travel") || t.includes("hotel") ||
    t.includes("conference") || t.includes("conferencia")
  ) return "travel";
  return "other";
}

/** Compute 30-minute free slots between 9am and 6pm with no event overlap. */
function computeFreeBlocks(dayEvents: CalendarEvent[], dayStart: Date): number {
  const workStart = new Date(dayStart); workStart.setHours(9,  0, 0, 0);
  const workEnd   = new Date(dayStart); workEnd.setHours(18,  0, 0, 0);
  let count = 0;
  const cursor = new Date(workStart);
  while (cursor < workEnd) {
    const slotEnd = new Date(cursor.getTime() + 30 * 60_000);
    const busy = dayEvents.some(e => !e.isAllDay && e.start < slotEnd && e.end > cursor);
    if (!busy) count++;
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return count;
}

/** Minutes of the day covered by at least one event (merged intervals, no double-counting). */
function computeLockedMinutes(dayEvents: CalendarEvent[]): number {
  const intervals = dayEvents
    .filter(e => !e.isAllDay)
    .map(e => ({ s: e.start.getTime(), e: e.end.getTime() }))
    .filter(i => i.s < i.e);

  if (!intervals.length) return 0;

  intervals.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const iv of intervals) {
    if (!merged.length || iv.s > merged[merged.length - 1].e) {
      merged.push({ ...iv });
    } else {
      merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, iv.e);
    }
  }

  return Math.round(merged.reduce((sum, iv) => sum + (iv.e - iv.s), 0) / 60_000);
}

/** % of the 9am–6pm window covered by events (merged intervals). */
function computeDensity(dayEvents: CalendarEvent[], dayStart: Date): number {
  const workStart = new Date(dayStart); workStart.setHours(9,  0, 0, 0);
  const workEnd   = new Date(dayStart); workEnd.setHours(18,  0, 0, 0);
  const windowMs  = workEnd.getTime() - workStart.getTime();

  const intervals = dayEvents
    .filter(e => !e.isAllDay)
    .map(e => ({
      s: Math.max(e.start.getTime(), workStart.getTime()),
      e: Math.min(e.end.getTime(),   workEnd.getTime()),
    }))
    .filter(i => i.s < i.e);

  if (!intervals.length) return 0;

  intervals.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const iv of intervals) {
    if (!merged.length || iv.s > merged[merged.length - 1].e) {
      merged.push({ ...iv });
    } else {
      merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, iv.e);
    }
  }

  const coveredMs = merged.reduce((sum, iv) => sum + (iv.e - iv.s), 0);
  return Math.round((coveredMs / windowMs) * 100);
}

/** Longest consecutive block of meetings (15-min gap tolerance). */
function computeLongestMeetingStretch(dayEvents: CalendarEvent[]): number {
  const ms = dayEvents
    .filter(e => !e.isAllDay && e.type === "meeting")
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (!ms.length) return 0;

  let longest = 0;
  let sStart  = ms[0].start;
  let sEnd    = ms[0].end;

  for (let i = 1; i < ms.length; i++) {
    if (ms[i].start.getTime() <= sEnd.getTime() + 15 * 60_000) {
      if (ms[i].end > sEnd) sEnd = ms[i].end;
    } else {
      longest = Math.max(longest, (sEnd.getTime() - sStart.getTime()) / 60_000);
      sStart  = ms[i].start;
      sEnd    = ms[i].end;
    }
  }
  return Math.round(Math.max(longest, (sEnd.getTime() - sStart.getTime()) / 60_000));
}

/* ─── Raw iCal parser ─── */

function parseICalText(
  text: string,
  calName: CalendarEvent["calendar"],
  windowStart: Date,
  windowEnd: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  // Normalize line endings, then unfold iCal line continuations
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (calName === "outlook") {
    console.log("[calendar] Outlook raw sample:", normalized.slice(0, 500));
  }
  const unfolded = normalized.replace(/\n[ \t]/g, "");
  const blocks = unfolded.split("BEGIN:VEVENT");
  console.log(`[calendar] Feed "${calName}": ${blocks.length - 1} VEVENT blocks after normalization`);

  for (const block of blocks.slice(1)) {
    const get = (field: string): string => {
      const match = block.match(new RegExp(field + "[^:]*:([^\r\n]+)", "i"));
      return match ? match[1].trim() : "";
    };

    const parseDate = (val: string): Date | null => {
      if (!val) return null;
      const clean = val.replace(/[TZ]/g, " ").trim();
      const dateStr =
        `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}` +
        (clean.length > 8
          ? ` ${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}`
          : "");
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const dtstart = get("DTSTART");
    const dtend   = get("DTEND");
    const start   = parseDate(dtstart);
    const end     = parseDate(dtend);
    if (!start || !end) continue;
    if (start < windowStart || start > windowEnd) continue;

    const dur = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (dur < 5) continue;

    const title   = get("SUMMARY") || "(No title)";
    const isAllDay = !dtstart.includes("T");

    events.push({
      title,
      start,
      end,
      durationMinutes: dur,
      isAllDay,
      calendar: calName,
      type: classifyEvent(title),
    });
  }

  return events;
}

/* ─── Feed fetching ─── */

async function parseFeed(
  url: string,
  calName: CalendarEvent["calendar"],
  windowStart: Date,
  windowEnd: Date,
): Promise<CalendarEvent[]> {
  let text: string;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "Accept": "text/calendar, text/plain, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (err) {
    console.warn(`[calendar] Feed "${calName}" fetch failed:`, (err as Error).message);
    return [];
  }

  console.log(`[calendar] Feed "${calName}": ${text.length} chars received`);
  const trimmed = text.trimStart();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
    console.warn(`[calendar] Feed "${calName}" returned an HTML page instead of iCal data — skipping`);
    return [];
  }

  try {
    const events = parseICalText(text, calName, windowStart, windowEnd);
    if (events.length > 0) {
      const first = events[0];
      console.log(`[calendar] Feed "${calName}": ${events.length} events after filter. First: "${first.title}" @ ${first.start.toISOString()}`);
    } else {
      console.warn(`[calendar] Feed "${calName}": 0 events survived the date/duration filter`);
    }
    return events;
  } catch (err) {
    console.warn(`[calendar] Feed "${calName}" parse failed:`, (err as Error).message);
    return [];
  }
}

/* ─── Mock fallback ─── */

function buildMockData(): CalendarData {
  const today = new Date();
  const last7Days: DayMetrics[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    last7Days.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalEvents: isWeekend ? 1 : 5,
      meetingCount: isWeekend ? 0 : 3,
      meetingMinutes: isWeekend ? 0 : 120,
      socialEvents: isWeekend ? 1 : 0,
      exerciseEvents: 0,
      freeBlocks: isWeekend ? 18 : 4,
      calendarDensity: isWeekend ? 0 : 45,
      longestMeetingStretch: isWeekend ? 0 : 90,
      totalBlockedMinutes: isWeekend ? 60 : 210,
      workMinutes: isWeekend ? 0 : 150,
      socialMinutes: isWeekend ? 60 : 0,
      personalMinutes: isWeekend ? 0 : 60,
    });
  }
  return {
    last7Days,
    summary: {
      avgMeetingsPerDay: 2.1,
      avgMeetingMinutesPerDay: 86,
      avgFreeBlocksPerDay: 7,
      busiestDay: "Wednesday",
      mostProductiveDay: "Friday",
      totalSocialEvents: 1,
      totalExerciseEvents: 0,
      upcomingToday: [],
    },
  };
}

/* ─── LLM event classifier ─── */

type EventCategory = "work" | "social" | "personal";

const CLASSIFIER_SYSTEM = `You are a calendar event classifier for an MBA student at Harvard Business School (HBS).

Classify each event title into exactly one of these categories:
- "work": HBS classes, case discussions, study groups, office hours, career events, recruiting, club meetings (professional/academic focus), work calls, meetings, conferences
- "social": social gatherings, dinners, parties, hangouts, dates, celebrations, social outings with friends
- "personal": gym, exercise, health appointments, family time, errands, personal admin, travel for personal reasons, religious events, private/personal time

Return ONLY a valid JSON object mapping each title to its category. No explanation, no markdown fences.
Example: {"Strategy Class": "work", "Dinner with friends": "social", "Gym": "personal"}`;

async function classifyEventsWithLLM(
  titles: string[],
): Promise<Record<string, EventCategory>> {
  const unique = [...new Set(titles)];
  if (!unique.length || !process.env.ANTHROPIC_API_KEY) return {};

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: CLASSIFIER_SYSTEM,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: `Classify these calendar event titles:\n${unique.map(t => `- "${t}"`).join("\n")}`,
        },
      ],
    });

    const raw = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    const parsed = JSON.parse(raw) as Record<string, string>;
    const valid = new Set<string>(["work", "social", "personal"]);
    const result: Record<string, EventCategory> = {};
    for (const [title, cat] of Object.entries(parsed)) {
      if (valid.has(cat)) result[title] = cat as EventCategory;
    }
    console.log(`[calendar] LLM classified ${Object.keys(result).length}/${unique.length} events`);
    return result;
  } catch (err) {
    console.warn("[calendar] LLM classification failed, falling back to keywords:", (err as Error).message);
    return {};
  }
}

function keywordFallbackCategory(type: EventType): EventCategory {
  if (type === "meeting" || type === "travel") return "work";
  if (type === "social") return "social";
  return "personal";
}

/* ─── Pipeline ─── */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function fetchAndParse(): Promise<CalendarData> {
  const now = new Date();

  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);
  windowStart.setHours(0, 0, 0, 0);

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 7);
  windowEnd.setHours(23, 59, 59, 999);

  console.log(`[calendar] Date filter: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const activeFeed = FEEDS.filter(f => f.url);
  if (!activeFeed.length) return buildMockData();

  const results = await Promise.all(
    activeFeed.map(f => parseFeed(f.url!, f.name, windowStart, windowEnd))
  );
  const allEvents = results.flat();

  if (!allEvents.length) {
    console.warn("[calendar] All feeds returned 0 events — using mock fallback");
    return buildMockData();
  }

  // Classify all event titles in a single LLM call
  const llmCategories = await classifyEventsWithLLM(allEvents.map(e => e.title));
  const getCategory = (e: CalendarEvent): EventCategory =>
    llmCategories[e.title] ?? keywordFallbackCategory(e.type);

  // Build per-day metrics for last 7 days
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const last7Days: DayMetrics[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(today);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const day = allEvents.filter(e => e.start >= dayStart && e.start <= dayEnd);
    const timed = day.filter(e => !e.isAllDay);
    const meetings = day.filter(e => e.type === "meeting");

    last7Days.push({
      date: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalEvents: day.length,
      meetingCount: meetings.length,
      meetingMinutes: meetings.reduce((s, e) => s + e.durationMinutes, 0),
      socialEvents:   day.filter(e => e.type === "social").length,
      exerciseEvents: day.filter(e => e.type === "exercise").length,
      freeBlocks:     computeFreeBlocks(day, dayStart),
      calendarDensity: computeDensity(day, dayStart),
      longestMeetingStretch: computeLongestMeetingStretch(day),
      totalBlockedMinutes: computeLockedMinutes(day),
      workMinutes:     timed.filter(e => getCategory(e) === "work").reduce((s, e) => s + e.durationMinutes, 0),
      socialMinutes:   timed.filter(e => getCategory(e) === "social").reduce((s, e) => s + e.durationMinutes, 0),
      personalMinutes: timed.filter(e => getCategory(e) === "personal").reduce((s, e) => s + e.durationMinutes, 0),
    });
  }

  const n = last7Days.length || 1;
  const avgMeetings    = Math.round((last7Days.reduce((s, d) => s + d.meetingCount, 0)  / n) * 10) / 10;
  const avgMtgMins     = Math.round( last7Days.reduce((s, d) => s + d.meetingMinutes, 0) / n);
  const avgFreeBlocks  = Math.round((last7Days.reduce((s, d) => s + d.freeBlocks, 0)    / n) * 10) / 10;

  // Busiest / most productive day name
  const busiestIdx      = last7Days.reduce((bi, d, i) => d.meetingCount  > last7Days[bi].meetingCount  ? i : bi, 0);
  const mostProdIdx     = last7Days.reduce((bi, d, i) => d.freeBlocks    > last7Days[bi].freeBlocks    ? i : bi, 0);
  const idxToDate = (idx: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - idx));
    return d;
  };

  // Events remaining today
  const tomorrowStart = new Date(today);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const upcomingToday = allEvents
    .filter(e => !e.isAllDay && e.start > now && e.start >= today && e.start < tomorrowStart)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 10);

  return {
    last7Days,
    summary: {
      avgMeetingsPerDay:    avgMeetings,
      avgMeetingMinutesPerDay: avgMtgMins,
      avgFreeBlocksPerDay:  avgFreeBlocks,
      busiestDay:        DAY_NAMES[idxToDate(busiestIdx).getDay()]  ?? "Unknown",
      mostProductiveDay: DAY_NAMES[idxToDate(mostProdIdx).getDay()] ?? "Unknown",
      totalSocialEvents:   last7Days.reduce((s, d) => s + d.socialEvents,   0),
      totalExerciseEvents: last7Days.reduce((s, d) => s + d.exerciseEvents, 0),
      upcomingToday,
    },
  };
}

/* ─── In-memory cache (1-hour TTL) ─── */

let cache: { data: CalendarData; ts: number } | null = null;
const CACHE_TTL = 60 * 60 * 1_000;

export async function getCalendarData(): Promise<CalendarData> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;
  const data = await fetchAndParse();
  cache = { data, ts: Date.now() };
  return data;
}

/* ─── Work-Life Balance score from calendar load ─── */

export function computeCalendarScore(data: CalendarData): number {
  const { avgMeetingsPerDay, avgFreeBlocksPerDay, avgMeetingMinutesPerDay } = data.summary;
  let score = 70; // baseline

  if      (avgMeetingsPerDay > 6) score -= 20;
  else if (avgMeetingsPerDay > 4) score -= 10;
  else if (avgMeetingsPerDay < 2) score += 10;

  if      (avgFreeBlocksPerDay > 4) score += 15;
  else if (avgFreeBlocksPerDay > 2) score += 8;
  else if (avgFreeBlocksPerDay < 1) score -= 15;

  if      (avgMeetingMinutesPerDay > 240) score -= 10;
  else if (avgMeetingMinutesPerDay > 180) score -= 5;

  return Math.min(100, Math.max(0, score));
}
