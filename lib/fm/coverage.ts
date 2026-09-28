// ---------------------------------------------------------------------
// lib/fm/coverage.ts — coverage resolution with PostGIS first,
// fail-closed when geometry is missing.
//
// The dispatcher bug: an event in a district outside the 12-entry
// centroid map fell through to "all active stations" — a Patna flood
// pushed to Delhi and Mumbai. For an emergency system that failure mode
// is backwards: unknown geometry must mean NARROW ( nobody), never WIDE.
//
// Resolution order:
//   1. PostGIS epicenter — disaster_events.epicenter (geometry Point)
//      against fm_stations.coverage_area (geography Polygon) via
//      ST_DWithin. This is the source of truth the migration built the
//      GIST index + compute trigger for; the old code never queried it.
//   2. District centroid + JS haversine (turf) — offline/demo path.
//   3. No signal → [] (fail closed) with a warning log.
//
// DB failures degrade one level (PostGIS → haversine → []), never to
// "everyone".
// ---------------------------------------------------------------------

import { prisma } from "@/server/prisma";
import { safeLog } from "@/lib/logger";
import { findStationsInRadius, type FmStationLike } from "./find-stations";

/** District centroids (WGS84 lng,lat) — keep in sync with cap-service. */
export const DISTRICT_CENTROIDS: Record<string, [number, number]> = {
  patna: [85.14, 25.59],
  puri: [85.82, 19.8],
  bihar: [85.31, 25.1],
  odisha: [84.35, 20.4],
  bhagalpur: [86.98, 25.24],
  muzaffarpur: [85.39, 26.12],
  munger: [86.47, 25.38],
  darbhanga: [85.9, 26.15],
  chennai: [80.27, 13.08],
  bengaluru: [77.59, 12.97],
  mumbai: [72.88, 19.08],
  kolkata: [88.36, 22.57],
};

export interface CoveragePoint {
  lat: number;
  lng: number;
  source: "epicenter" | "district";
}

/** District string → centroid point (null when unknown). */
export function districtCentroid(district: string | null | undefined): CoveragePoint | null {
  const key = (district ?? "").trim().toLowerCase();
  const centroid = DISTRICT_CENTROIDS[key];
  if (!centroid) return null;
  return { lng: centroid[0], lat: centroid[1], source: "district" };
}

/** Read the event epicenter via PostGIS (null when unset/unreadable). */
export async function readEventEpicenter(eventId: string): Promise<CoveragePoint | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ lng: number; lat: number }>>`
      SELECT ST_X(epicenter::geometry) AS lng, ST_Y(epicenter::geometry) AS lat
      FROM disaster_events
      WHERE id = ${eventId}::uuid AND epicenter IS NOT NULL
      LIMIT 1
    `;
    const row = rows[0];
    if (!row || !Number.isFinite(Number(row.lng)) || !Number.isFinite(Number(row.lat))) {
      return null;
    }
    return { lng: Number(row.lng), lat: Number(row.lat), source: "epicenter" };
  } catch {
    return null; // DB unreachable / column missing — caller degrades.
  }
}

/**
 * PostGIS covering-station IDs: ST_DWithin(coverage_area, event point).
 * Returns null on DB failure (caller falls back to haversine), [] when
 * the query succeeds but nothing covers the point.
 */
export async function queryCoveringStationIds(
  point: CoveragePoint,
  radiusKm: number,
): Promise<string[] | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM fm_stations
      WHERE is_active = true
        AND coverage_area IS NOT NULL
        AND ST_DWithin(
          coverage_area,
          ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326)::geography,
          ${Math.max(radiusKm, 1)} * 1000
        )
    `;
    return rows.map((r) => String(r.id));
  } catch (error: unknown) {
    safeLog("error", "[coverage] PostGIS lookup failed — degrading to haversine", {
      metadata: { error: String(error) },
    });
    return null;
  }
}

/**
 * Haversine filter over loaded stations (offline/demo path + PostGIS
 * fallback). Returns the matching subset (same object identities).
 */
export function filterByHaversine(
  stations: FmStationLike[],
  point: CoveragePoint,
  fallbackRadiusKm = 50,
): FmStationLike[] {
  return findStationsInRadius(point.lat, point.lng, stations, fallbackRadiusKm);
}

/**
 * Resolve the best coverage point for an event: epicenter first, then
 * district centroid, else null (caller MUST fail closed).
 */
export async function resolveCoveragePoint(
  eventId: string,
  district: string | null | undefined,
): Promise<CoveragePoint | null> {
  const epicenter = await readEventEpicenter(eventId);
  if (epicenter) return epicenter;
  return districtCentroid(district);
}
