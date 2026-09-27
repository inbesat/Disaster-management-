from pathlib import Path
p=Path('lib/map/place-search.ts')
p.write_text('''export type PlaceResult = {
  id: string;
  label: string;
  address: string | null;
  kind: string | null;
  lat: number;
  lng: number;
};

type RawPlace = {
  title?: unknown;
  address?: unknown;
  type?: unknown;
  data_id?: unknown;
  place_id?: unknown;
  gps_coordinates?: { latitude?: unknown; longitude?: unknown };
};

/** Keep only places with real, valid coordinates supplied by the provider. */
export function normalizePlaces(payload: unknown, limit = 6): PlaceResult[] {
  if (!payload || typeof payload !== "object") return [];
  const data = payload as { place_results?: RawPlace | RawPlace[]; local_results?: RawPlace[] };
  const individual = Array.isArray(data.place_results)
    ? data.place_results
    : data.place_results
      ? [data.place_results]
      : [];
  const rows = [...individual, ...(Array.isArray(data.local_results) ? data.local_results : [])];
  const seen = new Set<string>();
  const places: PlaceResult[] = [];
  for (const row of rows) {
    const lat = Number(row.gps_coordinates?.latitude);
    const lng = Number(row.gps_coordinates?.longitude);
    const label = typeof row.title === "string" ? row.title.trim() : "";
    if (!label || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const id = typeof row.data_id === "string" ? row.data_id : typeof row.place_id === "string" ? row.place_id : `${label}:${lat}:${lng}`;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push({
      id,
      label,
      address: typeof row.address === "string" ? row.address : null,
      kind: typeof row.type === "string" ? row.type : null,
      lat,
      lng,
    });
    if (places.length >= limit) break;
  }
  return places;
}

export function coordinatesFromQuery(query: string): PlaceResult | null {
  const match = query.match(/^\\s*(-?\\d+(?:\\.\\d+)?)\\s*,\\s*(-?\\d+(?:\\.\\d+)?)\\s*$/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { id: `coordinates:${lat}:${lng}`, label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, address: null, kind: "Coordinates", lat, lng };
}
''',encoding='utf-8')
p=Path('app/api/map/places/route.ts');p.parent.mkdir(parents=True,exist_ok=True)
p.write_text('''import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { coordinatesFromQuery, normalizePlaces, type PlaceResult } from "@/lib/map/place-search";

export const dynamic = "force-dynamic";
const limiter = createRateLimiter(12, 60_000);
const cache = new Map<string, { expires: number; results: PlaceResult[] }>();

export async function GET(request: NextRequest) {
  const auth = await requireRole(["field_responder", "district_admin", "super_admin"]);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 100) return NextResponse.json({ error: "Enter a place name between 2 and 100 characters." }, { status: 400 });
  const coordinates = coordinatesFromQuery(q);
  if (coordinates) return NextResponse.json({ places: [coordinates], source: "coordinates" });

  const cacheKey = q.toLocaleLowerCase();
  const saved = cache.get(cacheKey);
  if (saved && saved.expires > Date.now()) return NextResponse.json({ places: saved.results, source: "SerpAPI", cached: true });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!limiter(`places:${ip}`).success) return NextResponse.json({ error: "Too many searches. Please wait a minute." }, { status: 429 });
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return NextResponse.json({ error: "Place search is not configured on the server." }, { status: 503 });

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_maps");
    url.searchParams.set("type", "search");
    url.searchParams.set("q", q);
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", key);
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), cache: "no-store" });
    if (!response.ok) throw new Error(`Place provider returned ${response.status}`);
    const data = (await response.json()) as { error?: string };
    if (data.error) throw new Error("Place provider is unavailable.");
    const results = normalizePlaces(data);
    if (cache.size > 100) cache.clear();
    cache.set(cacheKey, { expires: Date.now() + 15 * 60_000, results });
    return NextResponse.json({ places: results, source: "SerpAPI" });
  } catch {
    return NextResponse.json({ error: "Place search is unavailable. Try coordinates or a preset hotspot." }, { status: 503 });
  }
}
''',encoding='utf-8')
p=Path('lib/map/place-search.test.ts')
p.write_text('''import { describe, expect, it } from "vitest";
import { coordinatesFromQuery, normalizePlaces } from "./place-search";

describe("place search result validation", () => {
  it("keeps only named results with valid coordinates", () => {
    const places = normalizePlaces({ local_results: [
      { title: "Patna", gps_coordinates: { latitude: 25.6, longitude: 85.1 }, address: "Bihar, India" },
      { title: "Broken", gps_coordinates: { latitude: 200, longitude: 85 } },
      { title: "Missing coordinates" },
    ] });
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({ label: "Patna", lat: 25.6, lng: 85.1 });
  });
  it("accepts valid coordinate searches and rejects out-of-range points", () => {
    expect(coordinatesFromQuery("25.5941, 85.1376")).toMatchObject({ lat: 25.5941, lng: 85.1376 });
    expect(coordinatesFromQuery("100, 85")).toBeNull();
  });
});
''',encoding='utf-8')
