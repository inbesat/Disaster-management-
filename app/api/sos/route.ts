import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import {
  decodeSosCodec,
  needPrefix,
  needToReportType,
  SosCodecError,
  type SosNeed,
} from "@/lib/sos/codec";

export const dynamic = "force-dynamic";

/**
 * POST /api/sos — Public emergency SOS endpoint (no auth required).
 * Creates a CrowdsourcedReport with type "rescue" and optional PWD priority flag.
 *
 * Phase 2: accepts EITHER a JSON payload (lat/lng/message/…) OR a compact
 * `codec` string (SOS1,lat,lng,need,HHMM*checksum) — the same code the PWA
 * shows for copy/QR/SMS relay and that satellite messengers can carry.
 * A mistyped code fails checksum validation with a 422, never silently.
 *
 * A GPS-less SOS is NEVER rejected: without usable coordinates the report is
 * recorded against the district fallback and flagged `[NO-GPS]` in rawText.
 * A trapped person without a GPS fix still reaches a human.
 */

// District fallback for GPS-less SOS (mirrors PATNA_CENTER in lib/field-offline.ts
// and the native SafeSphereMapHelperFallback — one canonical center).
const FALLBACK_LAT = 25.5941;
const FALLBACK_LNG = 85.1376;
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const message =
    typeof body.message === "string"
      ? body.message.slice(0, 2000)
      : "SOS — Emergency assistance needed";
  let reportType: "rescue" | "shelter_needed" =
    body.requestType === "food" ? "shelter_needed" : "rescue";
  let lat = body.lat != null ? Number(body.lat) : null;
  let lng = body.lng != null ? Number(body.lng) : null;
  let isPwd = body.isPwd === true;
  let codecNote = "";
  let needPrefixStr = "";

  // Phase 2: compact-codec ingest. Checksum-validated; a mistyped code is
  // rejected loudly so a garbled relay never becomes a mislocated rescue.
  if (typeof body.codec === "string" && body.codec.trim().length > 0) {
    try {
      const decoded = decodeSosCodec(body.codec);
      lat = decoded.lat;
      lng = decoded.lng;
      reportType = needToReportType(decoded.need);
      isPwd = isPwd || decoded.isPwd;
      const need: SosNeed = decoded.need;
      needPrefixStr = needPrefix(need);
      codecNote =
        ` · via code ${decoded.raw} (~${decoded.atUtc.toISOString().slice(0, 16).replace("T", " ")} UTC` +
        `${decoded.locationEstimated ? ", no GPS" : ""})`;
    } catch (error: unknown) {
      const detail =
        error instanceof SosCodecError ? error.message : "Invalid SOS code.";
      return NextResponse.json(
        {
          ok: false,
          error: `${detail} Call your local emergency number now.`,
        },
        { status: 422 },
      );
    }
  }

  // Phase 1 idempotency: outbox/Background-Sync replays carry the
  // client-generated `clientId`. It is stored namespaced (`sos:<id>`) in the
  // existing sessionId column — no migration — so a replay returns the
  // original row instead of creating a duplicate. A dedicated column is
  // deferred to Phase 5 (responder-side ingestion).
  const clientId =
    typeof body.clientId === "string" && body.clientId.length > 0
      ? body.clientId.slice(0, 64)
      : null;
  const idempotencyKey = clientId ? `sos:${clientId}` : null;

  // Phase 2: a GPS-less SOS is accepted, never rejected — recorded against
  // the district fallback and flagged so triage knows the position is
  // estimated. There is no location_estimated column; the [NO-GPS] prefix
  // in rawText is the marker (same convention as the PWD ⚡ suffix).
  let locationEstimated = false;
  if (
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    lat = FALLBACK_LAT;
    lng = FALLBACK_LNG;
    locationEstimated = true;
  }

  // Build rich raw_text with PWD info
  let rawText = `${needPrefixStr}${message}${codecNote}`;
  if (locationEstimated) rawText = `[NO-GPS] ${rawText}`;
  if (typeof body.name === "string" && body.name) {
    rawText = `[${body.name}] ${rawText}`;
  }
  if (isPwd) {
    const pwdInfo =
      typeof body.pwdDetails === "string" && body.pwdDetails
        ? `PWD: ${body.pwdDetails}`
        : "PWD: Person with disability — PRIORITY RESCUE";
    rawText = `${rawText} ⚡ ${pwdInfo}`;
  }

  try {
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
          message: "SOS report recorded. Responder notification has not been confirmed.",
          dispatched: false,
        });
      }
    }
    const report = await prisma.crowdsourcedReport.create({
      data: {
        lat: lat as number,
        lng: lng as number,
        reportType,
        source: "sos",
        rawText,
        confidenceScore: locationEstimated ? 0.7 : 1.0, // estimated position carries less weight
        verificationStatus: "unverified",
        isDemo: false,
        sessionId: idempotencyKey,
      },
    });

    return NextResponse.json({
      ok: true,
      sosId: report.id,
      message: "SOS report recorded. Responder notification has not been confirmed.",
      dispatched: false,
    });
  } catch (error: unknown) {
    console.error("Failed to create SOS report:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "SOS could not be recorded. Call your local emergency number now.",
      },
      { status: 503 },
    );
  }
}
