import { NextRequest, NextResponse } from "next/server";
import { getSafeWeatherData } from "@/lib/data-ingestion/fetcher";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));

  if (
    !request.nextUrl.searchParams.has("lat") ||
    !request.nextUrl.searchParams.has("lng") ||
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
    const data = await getSafeWeatherData(lat, lng);
    return NextResponse.json({ ok: true, ...data });
  } catch (error: unknown) {
    console.error("Live conditions failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch live conditions." },
      { status: 500 },
    );
  }
}
