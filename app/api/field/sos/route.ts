import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { sanitizeInput } from "@/lib/security/sanitize";
import { requireRole } from "@/lib/security/require-role";
import { GOV_ROLES } from "@/lib/validations/user";
import { decodeSosCodec, needPrefix, SosCodecError } from "@/lib/sos/codec";

export const runtime = "nodejs";

// District fallback for codec-relayed field SOS without a GPS fix
// (same canonical center as POST /api/sos).
const FALLBACK_LAT = 25.5941;
const FALLBACK_LNG = 85.1376;

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok)
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: {
    type?: string;
    responder?: string;
    lat?: number;
    lng?: number;
    clientId?: string;
    codec?: string;
    isPwd?: boolean;
    pwdDetails?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
  }
  // Phase 2: compact-codec ingest — a mesh/SMS-relayed code carries the
  // position + need when the JSON body cannot. Checksum-validated.
  let codecPrefix = "";
  let codecNote = "";
  let locationEstimated = false;
  if (typeof body.codec === "string" && body.codec.trim().length > 0) {
    try {
      const decoded = decodeSosCodec(body.codec);
      body = {
        ...body,
        lat: decoded.lat ?? FALLBACK_LAT,
        lng: decoded.lng ?? FALLBACK_LNG,
      };
      locationEstimated = decoded.locationEstimated;
      codecPrefix = needPrefix(decoded.need);
      if (decoded.isPwd && !body.isPwd) body = { ...body, isPwd: true };
      codecNote = ` · via code ${decoded.raw}`;
    } catch (error: unknown) {
      const detail =
        error instanceof SosCodecError ? error.message : "Invalid SOS code.";
      return NextResponse.json({ ok: false, error: detail }, { status: 422 });
    }
  }
  if (
    body.type !== "SOS_EMERGENCY" ||
    typeof body.lat !== "number" ||
    typeof body.lng !== "number" ||
    !Number.isFinite(body.lat) ||
    !Number.isFinite(body.lng) ||
    Math.abs(body.lat) > 90 ||
    Math.abs(body.lng) > 180
  ) {
    return NextResponse.json(
      { ok: false, error: "A valid SOS type and GPS location are required" },
      { status: 422 },
    );
  }

  try {
    // Phase 1 idempotency — same convention as /api/sos: replay-safe on the
    // client-generated `clientId`, stored namespaced in sessionId (no migration).
    const clientId =
      typeof body.clientId === "string" && body.clientId.length > 0
        ? body.clientId.slice(0, 64)
        : null;
    const idempotencyKey = clientId ? `sos:${clientId}` : null;
    if (idempotencyKey) {
      const existing = await prisma.crowdsourcedReport.findFirst({
        where: { sessionId: idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({
          ok: true,
          sosId: existing.id,
          deduped: true,
          recorded: true,
          dispatched: false,
          message: "SOS recorded; responder notification is unconfirmed",
        });
      }
    }
    const responder =
      typeof body.responder === "string"
        ? sanitizeInput(body.responder).slice(0, 120)
        : "Field responder";
    let rawText = `${codecPrefix}Field responder SOS from ${responder}${codecNote}`;
    if (locationEstimated) rawText = `[NO-GPS] ${rawText}`;
    if (body.isPwd) {
      const pwdInfo =
        typeof body.pwdDetails === "string" && body.pwdDetails
          ? `PWD: ${body.pwdDetails}`
          : "PWD: Person with disability — PRIORITY RESCUE";
      rawText = `${rawText} ⚡ ${pwdInfo}`;
    }
    const report = await prisma.crowdsourcedReport.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        reportType: "rescue",
        source: "field-sos",
        rawText,
        confidenceScore: 1,
        verificationStatus: "unverified",
        isDemo: false,
        sessionId: idempotencyKey,
      },
    });
    return NextResponse.json({
      ok: true,
      sosId: report.id,
      recorded: true,
      dispatched: false,
      message: "SOS recorded; responder notification is unconfirmed",
    });
  } catch (error) {
    console.error("Field SOS could not be recorded:", error);
    return NextResponse.json(
      {
        ok: false,
        recorded: false,
        dispatched: false,
        error: "SOS could not be recorded. Contact the control room directly.",
      },
      { status: 503 },
    );
  }
}
