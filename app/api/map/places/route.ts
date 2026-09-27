import { NextRequest, NextResponse } from "next/server";
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
