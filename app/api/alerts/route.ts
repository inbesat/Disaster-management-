import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/prisma";
import { requireRole } from "@/lib/security/require-role";
import { alertSchemas } from "@/lib/validations/api-schemas";
import { sanitizeInput } from "@/lib/security/sanitize";
import { warnDbUnavailableOnce } from "@/lib/server/db-fallback";

export const dynamic = "force-dynamic";

const GOV_ROLES = ["super_admin", "district_admin", "field_responder"] as const;

const DEFAULT_LIMIT = 20;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.min(
    50,
    Math.max(1, Number.isFinite(limitParam) ? limitParam : DEFAULT_LIMIT),
  );

  try {
    const alerts = await prisma.alertLog.findMany({
      where: { isDemo: false },
      select: {
        id: true,
        severity: true,
        channel: true,
        message: true,
        district: true,
        isAcknowledged: true,
        sentAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const unreadCount = alerts.filter((alert) => !alert.isAcknowledged).length;

    return NextResponse.json({ ok: true, alerts, unreadCount });
  } catch (error: unknown) {
    warnDbUnavailableOnce("alerts", error);
    return NextResponse.json(
      {
        ok: false,
        alerts: [],
        unreadCount: 0,
        error: "Alert database unavailable. Consult official alerts.",
      },
      { status: 503 },
    );
  }
}

// Create new alert with Zod input validation (Prompt 5.1).
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const json = await request.json();
    const body = alertSchemas.create.parse(json);

    const alert = await prisma.alertLog.create({
      data: {
        severity: body.severity,
        message: sanitizeInput(body.message),
        district: body.district,
        channel: "in_app",
      },
    });

    return NextResponse.json({ ok: true, alert });
  } catch (error: unknown) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Invalid payload." },
      { status: 400 },
    );
  }
}

// Mark one alert as acknowledged (mark-read).
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(GOV_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ ok: false, error: "Missing alert id." }, { status: 400 });
  }

  try {
    const alert = await prisma.alertLog.update({
      where: { id: body.id },
      data: {
        isAcknowledged: true,
        acknowledgedAt: new Date(),
      },
    });
    return NextResponse.json({ ok: true, alert });
  } catch (error: unknown) {
    console.error("Failed to acknowledge alert:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to acknowledge alert." },
      { status: 500 },
    );
  }
}
