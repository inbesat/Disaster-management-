import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const latParam = request.nextUrl.searchParams.get("lat");
  const lngParam = request.nextUrl.searchParams.get("lng");

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

  try {
    const url =
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}` +
      `&daily=river_discharge,river_discharge_max,river_discharge_mean` +
      `&forecast_days=7&timezone=auto`;

    const response = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Open-Meteo responded with status ${response.status}`);
    }

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        river_discharge?: number[];
        river_discharge_max?: number[];
        river_discharge_mean?: number[];
      };
    };

    const discharge = (data?.daily?.river_discharge ?? []).filter(
      (value) => typeof value === "number" && Number.isFinite(value),
    );
    const peak = discharge.length > 0 ? Math.max(...discharge) : null;

    return NextResponse.json({
      ok: true,
      coordinates: { lat, lng },
      daily: {
        time: data?.daily?.time ?? [],
        river_discharge: discharge,
        river_discharge_max: data?.daily?.river_discharge_max ?? [],
        river_discharge_mean: data?.daily?.river_discharge_mean ?? [],
      },
      peak_discharge_m3s: peak,
      warning_level: deriveWarning(peak),
    });
  } catch (error: unknown) {
    console.error("Flood fetch failed:", error);
    return NextResponse.json(
      { ok: false, source: "unavailable", error: "Live flood data is unavailable" },
      { status: 503 },
    );
  }
}

function deriveWarning(peak: number | null): string {
  if (peak === null) return "unknown";
  if (peak < 200) return "green";
  if (peak < 500) return "amber";
  if (peak < 1200) return "red";
  return "critical";
}
