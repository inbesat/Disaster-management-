import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { sanitizeInput } from "@/lib/security/sanitize";
import { requireRole } from "@/lib/security/require-role";
import { GOV_ROLES } from "@/lib/validations/user";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok)
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  let body: { type?: string; responder?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request body" },
      { status: 400 },
    );
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
    const responder =
      typeof body.responder === "string"
        ? sanitizeInput(body.responder).slice(0, 120)
        : "Field responder";
    const report = await prisma.crowdsourcedReport.create({
      data: {
        lat: body.lat,
        lng: body.lng,
        reportType: "rescue",
        source: "field-sos",
        rawText: `Field responder SOS from ${responder}`,
        confidenceScore: 1,
        verificationStatus: "unverified",
        isDemo: false,
        sessionId: null,
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
