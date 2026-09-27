import { NextRequest, NextResponse } from "next/server";
import { riskFromSignals, sumFinite } from "@/lib/predictions/outlook";

export const dynamic = "force-dynamic";

type DailySeries = {
  time: string[];
  precipitation_sum?: Array<number | null>;
  river_discharge?: Array<number | null>;
};
const DISTRICTS = {
  Patna: { lat: 25.5941, lng: 85.1376 },
  Bhagalpur: { lat: 25.2425, lng: 86.9842 },
  Gaya: { lat: 24.7914, lng: 85.0002 },
  Muzaffarpur: { lat: 26.1209, lng: 85.3647 },
  Darbhanga: { lat: 26.1542, lng: 85.8918 },
} as const;

async function loadSeries(url: URL): Promise<DailySeries> {
  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error(`Forecast provider returned ${response.status}`);
  const body = (await response.json()) as { daily?: DailySeries };
  if (!body.daily || !Array.isArray(body.daily.time))
    throw new Error("Forecast data is incomplete");
  return body.daily;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("district") ?? "Patna";
  if (!(name in DISTRICTS))
    return NextResponse.json({ error: "Choose a supported district." }, { status: 400 });
  const district = name as keyof typeof DISTRICTS;
  const { lat, lng } = DISTRICTS[district];
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  weatherUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "precipitation_sum",
    past_days: "7",
    forecast_days: "5",
    timezone: "Asia/Kolkata",
  }).toString();
  const riverUrl = new URL("https://flood-api.open-meteo.com/v1/flood");
  riverUrl.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "river_discharge",
    past_days: "7",
    forecast_days: "5",
    timezone: "Asia/Kolkata",
  }).toString();
  try {
    const [weather, riverResult] = await Promise.all([
      loadSeries(weatherUrl),
      loadSeries(riverUrl).catch(() => null),
    ]);
    if (
      !weather.precipitation_sum ||
      weather.precipitation_sum.length !== weather.time.length
    )
      throw new Error("Rainfall data is incomplete");
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const firstFuture = weather.time.findIndex((day) => day >= today);
    if (firstFuture < 0) throw new Error("No future forecast was returned");
    const rain = weather.precipitation_sum;
    const recent72h = sumFinite(rain.slice(Math.max(0, firstFuture - 3), firstFuture));
    const riverMap = new Map(
      riverResult?.time.map((day, index) => [
        day,
        riverResult.river_discharge?.[index] ?? null,
      ]) ?? [],
    );
    const pastRiver =
      riverResult?.time
        .filter((day) => day < today)
        .map((day) => riverMap.get(day))
        .filter(
          (value): value is number => typeof value === "number" && Number.isFinite(value),
        ) ?? [];
    const pastRiverMaximum = pastRiver.length ? Math.max(...pastRiver) : null;
    const outlook = weather.time.slice(firstFuture, firstFuture + 5).map((day, index) => {
      const rain24h = Number(rain[firstFuture + index] ?? 0);
      const rain72h = sumFinite(rain.slice(firstFuture + index, firstFuture + index + 3));
      const discharge = riverMap.get(day);
      const riverDischarge =
        typeof discharge === "number" && Number.isFinite(discharge) ? discharge : null;
      return {
        day,
        rain24h,
        rain72h,
        riverDischarge,
        ...riskFromSignals(rain24h, rain72h, recent72h, riverDischarge, pastRiverMaximum),
      };
    });
    return NextResponse.json(
      {
        district,
        generatedAt: new Date().toISOString(),
        source: {
          rainfall: "Open-Meteo forecast and past 7 days",
          river: riverResult ? "Open-Meteo GloFAS discharge" : "unavailable",
        },
        recent: { rainfall72h: recent72h, riverMaximum: pastRiverMaximum },
        outlook,
        limitations:
          "Indicative screening estimate based on weather forecasts and recent conditions. River data may represent a nearby 5 km grid cell. Consult official flood warnings before action.",
      },
      { headers: { "Cache-Control": "public, max-age=0, s-maxage=1800" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Forecast data is unavailable. Try again later or use official weather bulletins.",
      },
      { status: 503 },
    );
  }
}
