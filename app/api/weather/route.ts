import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { safeLog } from "@/lib/logger";

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

  // Never present invented weather as a live observation.
  if (!apiKey) {
    safeLog("warn", "OPENWEATHER_API_KEY not configured — weather unavailable.");
    return NextResponse.json(
      { ok: false, source: "unavailable", error: "Live weather data is unavailable" },
      { status: 503 },
    );
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
    const response = await fetch(url, {
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });

    // Invalid/expired key (401), quota exceeded (429), etc. — return an unavailable status.
    if (!response.ok) {
      safeLog(
        "warn",
        `OpenWeatherMap responded ${response.status} — weather unavailable.`,
      );
      return NextResponse.json(
        { ok: false, source: "unavailable", error: "Live weather data is unavailable" },
        { status: 503 },
      );
    }

    const data = (await response.json()) as {
      id?: number;
      main?: { temp?: number };
      rain?: { "1h"?: number; "3h"?: number };
      weather?: { description?: string }[];
    };

    const rainfallMm = data.rain?.["1h"] ?? data.rain?.["3h"] ?? 0;

    let recorded: {
      id: string;
      rainfallMm: number;
      district: string | null;
      lat: number;
      lng: number;
    } | null = null;
    try {
      const record = await prisma.weatherData.create({
        data: {
          stationId: data.id ? String(data.id) : null,
          timestamp: new Date(),
          rainfallMm,
          district: null,
          lat,
          lng,
        },
      });
      recorded = {
        id: record.id,
        rainfallMm: record.rainfallMm,
        district: record.district,
        lat: record.lat,
        lng: record.lng,
      };
    } catch (persistError: unknown) {
      safeLog("warn", "Failed to persist weather data (continuing)", {
        metadata: { error: String(persistError) },
      });
    }

    return NextResponse.json({
      ok: true,
      recorded,
      persisted: recorded !== null,
      source: "openweathermap",
      weather: {
        temperature_c: data.main?.temp ?? null,
        rainfall_mm: rainfallMm,
        description: data.weather?.[0]?.description ?? null,
      },
    });
  } catch (error: unknown) {
    // The upstream observation could not be verified.
    safeLog("warn", `Weather fetch failed — weather unavailable (${String(error)})`);
    return NextResponse.json(
      { ok: false, source: "unavailable", error: "Live weather data is unavailable" },
      { status: 503 },
    );
  }
}
