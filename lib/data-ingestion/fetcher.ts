import { prisma } from "@/server/prisma";

// ---------------------------------------------------------------------
// Resilient data fetcher for the SafeSphere Platform.
//
// getSafeWeatherData() tries the live internal routes first, validates
// the results, and falls back to deterministic synthetic data so the
// hackathon demo never breaks on a failed / rate-limited upstream API.
// ---------------------------------------------------------------------

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export type SafeWeatherResult = {
  source: "live" | "synthetic";
  rainfall_mm: number;
  cumulative_rainfall_72h?: number;
  river_level_m: number | null;
  river_discharge_m3s: number | null;
  river_name: string | null;
  district: string | null;
  lat: number;
  lng: number;
  fetchedAt: string;
};

const DEMO_DISTRICTS = [
  { name: "Patna", river: "Ganga", lat: 25.5941, lng: 85.1376 },
  { name: "Ernakulam", river: "Periyar", lat: 9.9816, lng: 76.2999 },
  { name: "Kamrup", river: "Brahmaputra", lat: 26.3161, lng: 91.5984 },
] as const;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    next: { revalidate: 0 },
    // Cap the upstream wait — a stalled Open-Meteo/OWM must never hang
    // /api/live-conditions (the map fires it on every pan).
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
  return response.json();
}

// Compact coordinate label used when the point isn't near a known district
// (e.g. 25.59°N, 85.14°E) so the UI is readable anywhere in the world.
function coordinateLabel(lat: number, lng: number) {
  const la = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}`;
  const lo = `${Math.abs(lng).toFixed(2)}°${lng >= 0 ? "E" : "W"}`;
  return `${la}, ${lo}`;
}

/**
 * Resolve the nearest known demo district for a coordinate (or a readable
 * coordinate label when the point isn't near one). Exported so the ML
 * bridge (lib/ml-client.ts) can drive the Phase 7 FM automation hook.
 */
export function nearestDistrict(lat: number, lng: number) {
  let best: (typeof DEMO_DISTRICTS)[number] = DEMO_DISTRICTS[0];
  let bestDistance = Infinity;
  for (const district of DEMO_DISTRICTS) {
    const distance = Math.hypot(district.lat - lat, district.lng - lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = district;
    }
  }
  // Only claim a known district when the point is genuinely nearby;
  // otherwise label the location from its coordinates.
  if (bestDistance <= 1.5) {
    return best;
  }
  return { name: coordinateLabel(lat, lng), river: null, lat, lng };
}

// Deterministic pseudo-random so the synthetic data is stable per location.
function seeded(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateSynthetic(lat: number, lng: number) {
  const seed = lat * 1000 + lng;
  return {
    rainfall_mm: Math.round(40 + seeded(seed) * 50),
    river_level_m: Number((8.5 + seeded(seed + 1) * 3).toFixed(1)),
    river_discharge_m3s: Math.round(800 + seeded(seed + 2) * 1200),
  };
}

async function logDataSource(name: string, endpoint: string, status: "green" | "red") {
  try {
    const existing = await prisma.dataSource.findFirst({ where: { name } });
    if (existing) {
      await prisma.dataSource.update({
        where: { id: existing.id },
        data: { status, lastFetchTime: new Date(), isActive: true },
      });
    } else {
      await prisma.dataSource.create({
        data: { name, endpoint, status, lastFetchTime: new Date() },
      });
    }
  } catch (error: unknown) {
    console.error(`Failed to log data source health for "${name}":`, error);
  }
}

function validateRainfall(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1000;
}

function validateDischarge(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export async function getSafeWeatherData(
  lat: number,
  lng: number,
): Promise<SafeWeatherResult> {
  let rainfallMm = 0;
  let cumulativeRainfall: number | undefined;
  let riverDischarge: number | null = null;
  let weatherOk = false;
  let floodOk = false;

  // 1. Try live weather (rainfall).
  try {
    const weather = (await fetchJson(
      `${baseUrl()}/api/weather?lat=${lat}&lng=${lng}`,
    )) as { source?: string; weather?: { rainfall_mm?: number } };
    if (weather.source === "mock" || weather.source === "synthetic")
      throw new Error("Weather source is simulated");
    const rain = Number(weather?.weather?.rainfall_mm);
    if (validateRainfall(rain)) {
      rainfallMm = rain;
      weatherOk = true;
    } else {
      throw new Error(`Rainfall validation failed: ${rain}`);
    }
  } catch (error: unknown) {
    console.warn("Live weather fetch failed, falling back:", error);
  }

  // The ML model needs 72-hour precipitation, not the current one-hour amount.
  try {
    const history = (await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation&past_hours=72&forecast_hours=1&timezone=GMT`,
    )) as { hourly?: { time?: string[]; precipitation?: Array<number | null> } };
    const now = Date.now();
    const values = (history.hourly?.time ?? []).flatMap((time, index) => {
      const at = Date.parse(time + "Z"),
        value = history.hourly?.precipitation?.[index];
      return at <= now &&
        at > now - 72 * 3600000 &&
        typeof value === "number" &&
        Number.isFinite(value)
        ? [value]
        : [];
    });
    if (values.length === 72)
      cumulativeRainfall = values.reduce((sum, value) => sum + value, 0);
  } catch {
    /* Missing history disables automatic model estimates. */
  }

  // 2. Try live flood (river discharge).
  try {
    const flood = (await fetchJson(`${baseUrl()}/api/flood?lat=${lat}&lng=${lng}`)) as {
      peak_discharge_m3s?: number;
      source?: string;
    };
    if (flood.source === "mock" || flood.peak_discharge_m3s == null)
      throw new Error("Flood source is unavailable");
    const discharge = Number(flood.peak_discharge_m3s);
    if (validateDischarge(discharge)) {
      riverDischarge = discharge;
      floodOk = true;
    } else {
      throw new Error(`Discharge validation failed: ${discharge}`);
    }
  } catch (error: unknown) {
    console.warn("Live flood fetch failed, falling back:", error);
  }

  // 3. Log upstream health in the data_source registry.
  await logDataSource(
    "OpenWeatherMap",
    `${baseUrl()}/api/weather`,
    weatherOk ? "green" : "red",
  );
  await logDataSource(
    "Open-Meteo Flood",
    `${baseUrl()}/api/flood`,
    floodOk ? "green" : "red",
  );

  const place = nearestDistrict(lat, lng);

  if (weatherOk && floodOk) {
    return {
      source: "live",
      rainfall_mm: rainfallMm,
      cumulative_rainfall_72h: cumulativeRainfall,
      river_level_m: null,
      river_discharge_m3s: riverDischarge,
      river_name: place.river,
      district: place.name,
      lat,
      lng,
      fetchedAt: new Date().toISOString(),
    };
  }

  // 4. Synthetic fallback keeps the demo alive.
  const synthetic = generateSynthetic(lat, lng);
  return {
    source: "synthetic",
    ...synthetic,
    river_name: place.river,
    district: place.name,
    lat,
    lng,
    fetchedAt: new Date().toISOString(),
  };
}
