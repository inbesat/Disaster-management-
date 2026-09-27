import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";

export const dynamic = "force-dynamic";

/**
 * POST /api/sos — Public emergency SOS endpoint (no auth required).
 * Creates a CrowdsourcedReport with type "rescue" and optional PWD priority flag.
 */
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
  const requestType = body.requestType === "food" ? "food" : "rescue";
  const lat = body.lat != null ? Number(body.lat) : null;
  const lng = body.lng != null ? Number(body.lng) : null;

  if (
    lat === null ||
    lng === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "A valid location is required to record an SOS. Call your local emergency number now.",
      },
      { status: 422 },
    );
  }

  // Build rich raw_text with PWD info
  let rawText = message;
  if (typeof body.name === "string" && body.name) {
    rawText = `[${body.name}] ${rawText}`;
  }
  if (body.isPwd) {
    const pwdInfo =
      typeof body.pwdDetails === "string" && body.pwdDetails
        ? `PWD: ${body.pwdDetails}`
        : "PWD: Person with disability — PRIORITY RESCUE";
    rawText = `${rawText} ⚡ ${pwdInfo}`;
  }

  try {
    const report = await prisma.crowdsourcedReport.create({
      data: {
        lat,
        lng,
        reportType: requestType === "food" ? "shelter_needed" : "rescue",
        source: "sos",
        rawText,
        confidenceScore: 1.0, // SOS = highest confidence
        verificationStatus: "unverified",
        isDemo: false,
        sessionId: null,
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
