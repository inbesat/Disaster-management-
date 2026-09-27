import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireRole } from "@/lib/security/require-role";
import { sanitizeInput } from "@/lib/security/sanitize";
import { serializeFmStation } from "@/lib/fm/serialize";

export const dynamic = "force-dynamic";

const GOV_ROLES = ["super_admin", "district_admin", "field_responder"] as const;

/** List FM stations — filtered by optional query params (admin UI table). */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const city = searchParams.get("city");
  const type = searchParams.get("type");
  const active = searchParams.get("active");

  try {
    const stations = await prisma.fmStation.findMany({
      where: {
        ...(state ? { state } : {}),
        ...(city ? { city } : {}),
        ...(type ? { type } : {}),
        ...(active === "true" ? { isActive: true } : {}),
        ...(active === "false" ? { isActive: false } : {}),
      },
      orderBy: [{ type: "asc" }, { city: "asc" }, { name: "asc" }],
    });

    const rows = stations.map((s) => ({
      ...serializeFmStation(s),
      name: sanitizeInput(s.name),
      city: sanitizeInput(s.city),
      state: sanitizeInput(s.state),
      operator: s.operator ? sanitizeInput(s.operator) : null,
    }));

    return NextResponse.json({ ok: true, stations: rows });
  } catch (error: unknown) {
    // DB unreachable (migrations not pushed / offline) — serve the seeded
    // demo list so the admin UI and coverage tool keep working.
    console.error("Failed to list FM stations:", error);
    return NextResponse.json(
      {
        ok: false,
        stations: [],
        source: "unavailable",
        error: "Station registry unavailable; no broadcast destination was verified.",
      },
      { status: 503 },
    );
  }
}

/** Create a new FM station (admin CRUD). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(["super_admin", "district_admin"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const frequency = typeof body.frequency === "string" ? body.frequency.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";

  if (!name || !frequency || !city || !state) {
    return NextResponse.json(
      { ok: false, error: "name, frequency, city and state are required." },
      { status: 400 },
    );
  }

  const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
  const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;

  try {
    const station = await prisma.fmStation.create({
      data: {
        name,
        frequency,
        city,
        state,
        callSign: typeof body.callSign === "string" ? body.callSign : null,
        coverageRadiusKm: Number(body.coverageRadiusKm) || 50,
        lat: lat !== null ? lat : undefined,
        lng: lng !== null ? lng : undefined,
        operator: typeof body.operator === "string" ? body.operator : null,
        type: typeof body.type === "string" ? body.type : "private",
        emergencyApiEndpoint:
          typeof body.emergencyApiEndpoint === "string"
            ? body.emergencyApiEndpoint
            : null,
        emergencyContactPhone:
          typeof body.emergencyContactPhone === "string"
            ? body.emergencyContactPhone
            : null,
        rdsEnabled: body.rdsEnabled === true,
        rdsApiEndpoint:
          typeof body.rdsApiEndpoint === "string" ? body.rdsApiEndpoint : null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json({ ok: true, station: serializeFmStation(station) });
  } catch (error: unknown) {
    console.error("Failed to create FM station:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to create FM station." },
      { status: 500 },
    );
  }
}
