import { NextRequest, NextResponse } from "next/server";
import { safeLog } from "@/lib/logger";

// Three-day forecast aggregated from OpenWeatherMap. Missing upstream data
// is reported as unavailable, never replaced by plausible invented weather.

export type ForecastDay = {
  /** ISO date (yyyy-mm-dd). */
  date: string;
  tempHigh: number;
  rainTotal: number;
  /** Coarse bucket the UI maps to an icon. */
  condition: "rain" | "clouds" | "clear" | "storm";
};

/** Pick the dominant condition across a day's 3h buckets. */
function aggregate(
  list: Array<{
    dt_txt?: string;
    main?: { temp_max?: number };
    rain?: { "3h"?: number };
    weather?: { main?: string }[];
  }>,
): ForecastDay[] {
  const byDay = new Map<string, { high: number; rain: number; codes: string[] }>();
  for (const item of list) {
    if (!item.dt_txt) continue;
    const day = item.dt_txt.slice(0, 10);
    const entry = byDay.get(day) ?? { high: -99, rain: 0, codes: [] };
    if (typeof item.main?.temp_max === "number") {
      entry.high = Math.max(entry.high, item.main.temp_max);
    }
    entry.rain += item.rain?.["3h"] ?? 0;
    if (item.weather?.[0]?.main) entry.codes.push(item.weather[0].main);
    byDay.set(day, entry);
  }

  const days: ForecastDay[] = [];
  for (const [date, e] of byDay) {
    const rainTotal = Math.round(e.rain * 10) / 10;
    const stormy = e.codes.some((c) => /thunder|storm/i.test(c));
    const rainy = e.codes.some((c) => /rain|drizzle/i.test(c));
    const cloudy = e.codes.some((c) => /cloud/i.test(c));
    days.push({
      date,
      tempHigh: e.high === -99 ? 0 : Math.round(e.high * 10) / 10,
      rainTotal,
      condition:
        stormy || rainTotal > 90
          ? "storm"
          : rainy || rainTotal > 2
            ? "rain"
            : cloudy
              ? "clouds"
              : "clear",
    });
    if (days.length === 3) break;
  }
  return days;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");
  const apiKey = process.env.OPENWEATHER_API_KEY;

  const lat = Number(latParam);
  const lng = Number(lngParam);
  if (
    !latParam ||
    !lngParam ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return NextResponse.json(
      { error: "Missing or invalid 'lat' / 'lng' query parameters." },
      { status: 400 },
    );
  }

  // Do not invent forecast data when the service is not configured.
  if (!apiKey) {
    safeLog(
      "warn",
      "[forecast] OPENWEATHER_API_KEY not configured — forecast unavailable.",
    );
    return NextResponse.json(
      {
        ok: false,
        source: "unavailable",
        days: [],
        error: "Live forecast is unavailable",
      },
      { status: 503 },
    );
  }

  try {
    const url =
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}` +
      `&appid=${apiKey}&units=metric`;
    const response = await fetch(url, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      safeLog(
        "warn",
        `[forecast] OpenWeatherMap ${response.status} — forecast unavailable.`,
      );
      return NextResponse.json(
        {
          ok: false,
          source: "unavailable",
          days: [],
          error: "Live forecast is unavailable",
        },
        { status: 503 },
      );
    }

    const data = (await response.json()) as { list?: Parameters<typeof aggregate>[0] };
    const days = aggregate(data.list ?? []);
    if (days.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          source: "unavailable",
          days: [],
          error: "Live forecast is unavailable",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      ok: true,
      source: "openweathermap",
      days,
      location: { lat, lng },
    });
  } catch (error: unknown) {
    safeLog("warn", `[forecast] fetch failed — forecast unavailable (${String(error)}).`);
    return NextResponse.json(
      {
        ok: false,
        source: "unavailable",
        days: [],
        error: "Live forecast is unavailable",
      },
      { status: 503 },
    );
  }
}
