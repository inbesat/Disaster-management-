import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireRole } from "@/lib/security/require-role";
import { findStationsInRadius } from "@/lib/fm/find-stations";
import { toCoords, type FmStationDTO } from "@/lib/fm/serialize";

export const dynamic = "force-dynamic";

const GOV_ROLES = ["super_admin", "district_admin", "field_responder"] as const;

/**
 * "Test Coverage" tool — click a point on the admin map and see which FM
 * stations cover it. Uses the PostGIS-derived coverage radius (lat/lng +
 * coverage_radius_km) via the turf great-circle fallback, so it answers
 * correctly even before the PostGIS geometry column is populated.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const latParam = searchParams.get("lat");
  const lngParam = searchParams.get("lng");
  const lat = Number(latParam);
  const lng = Number(lngParam);
  const radius = Number(searchParams.get("radius") ?? 50);

  if (!latParam || !lngParam || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || !Number.isFinite(radius) || radius <= 0 || radius > 500) {
    return NextResponse.json(
      { ok: false, error: "lat and lng query params are required." },
      { status: 400 },
    );
  }

  try {
    const stations = await prisma.fmStation.findMany({ where: { isActive: true } });

    const withCoords: FmStationDTO[] = stations.map((s) => ({
      ...toCoords(s.lat, s.lng),
      id: s.id,
      name: s.name,
      frequency: s.frequency,
      city: s.city,
      state: s.state,
      callSign: s.callSign,
      coverageRadiusKm: s.coverageRadiusKm,
      operator: s.operator,
      type: s.type,
      emergencyApiEndpoint: s.emergencyApiEndpoint,
      emergencyContactPhone: s.emergencyContactPhone,
      rdsEnabled: s.rdsEnabled,
      rdsApiEndpoint: s.rdsApiEndpoint,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    const covering = findStationsInRadius(lat, lng, withCoords, radius);
    return NextResponse.json({
      ok: true,
      point: { lat, lng },
      covering,
      count: covering.length,
    });
  } catch (error: unknown) {
    console.error("Failed to test FM coverage:", error);
    return NextResponse.json({ ok: false, source: "unavailable", covering: [], count: 0, error: "FM coverage is unavailable" }, { status: 503 });
  }
}
