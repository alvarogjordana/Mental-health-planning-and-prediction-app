/**
 * Weather integration — OpenWeatherMap free tier
 * Server-only module — OPENWEATHER_API_KEY must never be sent to the browser.
 */

import { prisma } from "@/lib/db";

/* ─── Public types ─── */

export interface WeatherData {
  current: {
    city: string;
    tempF: number;
    condition: string;    // OWM main: "Clear", "Clouds", "Rain", "Snow", "Drizzle", etc.
    description: string;  // OWM description: "broken clouds", "light rain", etc.
    humidity: number;
    windMph: number;
  };
  last7Days: {
    date: string;       // "YYYY-MM-DD"
    tempF: number;
    condition: string;
    humidity: number;
  }[];
  next5Days: {
    date: string;
    tempF: number;
    condition: string;
    humidity: number;
  }[];
}

export interface WeatherModifiers {
  health: number;
  sleep: number;
  social: number;
  purpose: number;
}

/* ─── OWM response shapes ─── */

interface OWMCurrentResponse {
  name: string;
  main: { temp: number; humidity: number };
  weather: { main: string; description: string }[];
  wind: { speed: number };
}

interface OWMForecastItem {
  dt: number;
  main: { temp: number; humidity: number };
  weather: { main: string; description: string }[];
}

interface OWMForecastResponse {
  list: OWMForecastItem[];
}

const BASE = "https://api.openweathermap.org/data/2.5";

/* ─── Private fetch helpers ─── */

async function fetchCurrent(city: string, key: string): Promise<OWMCurrentResponse | null> {
  try {
    const url = `${BASE}/weather?q=${encodeURIComponent(city)}&appid=${key}&units=imperial`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // 30-min server cache
    if (!res.ok) { console.warn(`OWM current ${res.status} for "${city}"`); return null; }
    return res.json() as Promise<OWMCurrentResponse>;
  } catch (err) {
    console.warn("OWM current fetch failed:", err);
    return null;
  }
}

async function fetchForecast(city: string, key: string): Promise<OWMForecastResponse | null> {
  try {
    const url = `${BASE}/forecast?q=${encodeURIComponent(city)}&appid=${key}&units=imperial&cnt=40`;
    const res = await fetch(url, { next: { revalidate: 3600 } }); // 1-hr server cache
    if (!res.ok) { console.warn(`OWM forecast ${res.status} for "${city}"`); return null; }
    return res.json() as Promise<OWMForecastResponse>;
  } catch (err) {
    console.warn("OWM forecast fetch failed:", err);
    return null;
  }
}

/** Aggregate 3-hour forecast intervals into per-day summaries (up to 5 days). */
function aggregateForecast(items: OWMForecastItem[]): WeatherData["next5Days"] {
  const byDay = new Map<string, { temps: number[]; humidities: number[]; conditions: string[] }>();
  for (const item of items) {
    const date = new Date(item.dt * 1000).toISOString().split("T")[0];
    if (!byDay.has(date)) byDay.set(date, { temps: [], humidities: [], conditions: [] });
    const day = byDay.get(date)!;
    day.temps.push(item.main.temp);
    day.humidities.push(item.main.humidity);
    day.conditions.push(item.weather[0]?.main ?? "Clear");
  }
  return Array.from(byDay.entries())
    .slice(0, 5)
    .map(([date, { temps, humidities, conditions }]) => {
      const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
      const avgHum  = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length);
      const counts: Record<string, number> = {};
      for (const c of conditions) counts[c] = (counts[c] ?? 0) + 1;
      const dominant = Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "Clear";
      return { date, tempF: avgTemp, condition: dominant, humidity: avgHum };
    });
}

/* ─── Weather log ─── */

/**
 * Upserts today's weather into WeatherLog (one record per user per day).
 * Called as a fire-and-forget side-effect inside getWeatherData.
 */
export async function logTodayWeather(
  userId: string,
  city: string,
  key: string
): Promise<void> {
  const raw = await fetchCurrent(city, key);
  if (!raw) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const existing = await prisma.weatherLog.findFirst({
      where: { userId, date: { gte: today, lt: tomorrow } },
    });
    const payload = {
      userId,
      date: today,
      city: raw.name || city,
      tempF: raw.main.temp,
      condition: raw.weather[0]?.main ?? "Clear",
      humidity: raw.main.humidity,
      windMph: raw.wind.speed,
    };
    if (existing) {
      await prisma.weatherLog.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.weatherLog.create({ data: payload });
    }
  } catch (err) {
    console.warn("WeatherLog upsert failed:", err);
  }
}

/* ─── Main export ─── */

/**
 * Returns real-time weather data for the user's saved city.
 * Falls back to stored WeatherLog records + interpolation if the API is down.
 * Returns null only when there is truly no data at all.
 */
export async function getWeatherData(userId: string): Promise<WeatherData | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) {
    console.warn("OPENWEATHER_API_KEY not set — weather unavailable");
    return null;
  }

  // Resolve the user's city from DB, fall back to env default
  let city = process.env.NEXT_PUBLIC_DEFAULT_LOCATION ?? "Boston";
  try {
    const user = await prisma.user.findFirst({ where: { id: userId }, select: { location: true } });
    if (user?.location) city = user.location;
  } catch { /* keep default */ }

  // Fetch live + log today in parallel; logTodayWeather is a side-effect
  const [current, forecast] = await Promise.all([
    fetchCurrent(city, key),
    fetchForecast(city, key),
    logTodayWeather(userId, city, key),
  ]);

  // Full fallback to stored logs when API is unavailable
  if (!current) {
    try {
      const logs = await prisma.weatherLog.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 7,
      });
      if (logs.length === 0) return null;
      const latest = logs[0];
      return {
        current: {
          city: latest.city,
          tempF: Math.round(latest.tempF),
          condition: latest.condition,
          description: latest.condition.toLowerCase(),
          humidity: latest.humidity,
          windMph: Math.round(latest.windMph),
        },
        last7Days: [...logs].reverse().map((l) => ({
          date: new Date(l.date).toISOString().split("T")[0],
          tempF: Math.round(l.tempF),
          condition: l.condition,
          humidity: l.humidity,
        })),
        next5Days: [],
      };
    } catch {
      return null;
    }
  }

  // Build last-7-days: stored logs where available, interpolated otherwise
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let storedLogs: { date: Date; tempF: number; condition: string; humidity: number }[] = [];
  try {
    storedLogs = await prisma.weatherLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: 7,
      select: { date: true, tempF: true, condition: true, humidity: true },
    });
  } catch { /* storedLogs stays empty */ }

  const logByDate = new Map(
    storedLogs.map((l) => [new Date(l.date).toISOString().split("T")[0], l])
  );

  const last7Days: WeatherData["last7Days"] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const stored = logByDate.get(dateStr);
    if (stored) {
      last7Days.push({
        date: dateStr,
        tempF: Math.round(stored.tempF),
        condition: stored.condition,
        humidity: stored.humidity,
      });
    } else {
      // Interpolate: current temp ±3°F random jitter, same condition
      const jitter = Math.round((Math.random() - 0.5) * 6);
      last7Days.push({
        date: dateStr,
        tempF: Math.round(current.main.temp + jitter),
        condition: current.weather[0]?.main ?? "Clear",
        humidity: current.main.humidity,
      });
    }
  }

  return {
    current: {
      city: current.name || city,
      tempF: Math.round(current.main.temp),
      condition: current.weather[0]?.main ?? "Clear",
      description: current.weather[0]?.description ?? "clear",
      humidity: current.main.humidity,
      windMph: Math.round(current.wind.speed),
    },
    last7Days,
    next5Days: forecast ? aggregateForecast(forecast.list) : [],
  };
}

/* ─── Score modifiers ─── */

/**
 * Computes wellbeing score modifiers from current and recent weather.
 * Apply the returned deltas to individual vertical scores before
 * computing the weighted overall, then clamp each modified score to [0, 100].
 */
export function computeWeatherModifiers(weather: WeatherData): WeatherModifiers {
  const mods: WeatherModifiers = { health: 0, sleep: 0, social: 0, purpose: 0 };
  const { condition, tempF } = weather.current;

  // Sunshine boosts outdoor activity and social motivation
  if (condition === "Clear") {
    mods.health += 4;
    mods.social += 3;
  }

  // Rain or snow makes outdoor activity less likely
  if (condition === "Rain" || condition === "Snow") {
    mods.health -= 4;
  }

  // Comfortable temperature
  if (tempF >= 50 && tempF <= 75) {
    mods.health += 3;
  }

  // Extreme temperatures suppress activity
  if (tempF < 32 || tempF > 90) {
    mods.health -= 5;
  }

  // 3+ consecutive gloomy days → purpose and sleep dip
  const recent3 = weather.last7Days.slice(-3).map((d) => d.condition);
  const allGloomy =
    recent3.length === 3 &&
    recent3.every((c) => c === "Clouds" || c === "Rain" || c === "Snow");
  if (allGloomy) {
    mods.purpose -= 4;
    mods.sleep   -= 2;
  }

  // Nice weekend bonus
  const dow = new Date().getDay();
  if ((dow === 6 || dow === 0) && condition === "Clear") {
    mods.social += 4;
  }

  return mods;
}
