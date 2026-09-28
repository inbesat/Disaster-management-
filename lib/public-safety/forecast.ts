import { riskFromSignals, sumFinite } from "@/lib/predictions/outlook";
import { coordinates, type PublicLocation } from "./location";

type Series = {
  time: string[];
  precipitation_sum?: (number | null)[];
  river_discharge?: (number | null)[];
};
async function load(url: URL): Promise<Series> {
  const response = await fetch(url, {
    next: { revalidate: 1800 },
    signal: AbortSignal.timeout(9000),
  });
  if (!response.ok) throw new Error("Forecast unavailable");
  const body = await response.json();
  if (!Array.isArray(body.daily?.time)) throw new Error("Incomplete forecast");
  return body.daily;
}

export async function loadPublicForecast(location: PublicLocation) {
  const { lat, lng } = coordinates(location);
  const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
  const riverUrl = new URL("https://flood-api.open-meteo.com/v1/flood");
  const common = {
    latitude: String(lat),
    longitude: String(lng),
    past_days: "7",
    forecast_days: "5",
    timezone: "Asia/Kolkata",
  };
  weatherUrl.search = new URLSearchParams({
    ...common,
    daily: "precipitation_sum",
  }).toString();
  riverUrl.search = new URLSearchParams({
    ...common,
    daily: "river_discharge",
  }).toString();
  const [weather, river] = await Promise.all([
    load(weatherUrl),
    load(riverUrl).catch(() => null),
  ]);
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const first = weather.time.findIndex((day) => day >= today);
  const rain = weather.precipitation_sum;
  // Missing rain must not become zero rainfall and a reassuring LOW label.
  if (
    first < 3 ||
    !rain ||
    weather.time.slice(first, first + 5).length < 5 ||
    rain
      .slice(first - 3, first + 5)
      .some((value) => typeof value !== "number" || !Number.isFinite(value)) ||
    rain.length !== weather.time.length
  )
    throw new Error("Incomplete rainfall data");
  const recent72h = sumFinite(rain.slice(first - 3, first));
  const riverMap = new Map(
    river?.time.map((day, i) => [day, river.river_discharge?.[i] ?? null]) ?? [],
  );
  const past =
    river?.time
      .filter((day) => day < today)
      .map((day) => riverMap.get(day))
      .filter(
        (value): value is number => typeof value === "number" && Number.isFinite(value),
      ) ?? [];
  const riverMaximum = past.length ? Math.max(...past) : null;
  const days = weather.time.slice(first, first + 3).map((day, i) => {
    const rain24h = rain[first + i]!;
    const rain72h = sumFinite(rain.slice(first + i, first + i + 3));
    const raw = riverMap.get(day);
    const discharge = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    return {
      day,
      rain24h,
      rain72h,
      riverDischarge: discharge,
      ...riskFromSignals(rain24h, rain72h, recent72h, discharge, riverMaximum),
    };
  });
  return {
    days,
    recentRainfall72h: recent72h,
    source: "Open-Meteo weather forecast and past 7 days",
    riverSource: riverMaximum !== null ? "Open-Meteo GloFAS" : "unavailable",
  };
}
export type PublicForecast = Awaited<ReturnType<typeof loadPublicForecast>>;
