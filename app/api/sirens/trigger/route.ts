import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { triggerSirens } from "@/lib/sirens/controller";

export const dynamic = "force-dynamic";

// Sounding towers is a privileged, dangerous action — operators only.
const TRIGGER_ROLES = ["super_admin", "district_admin"] as const;

const triggerLimiter = createRateLimiter(5, 60_000);

/**
 * POST /api/sirens/trigger — sound towers.
 * Body: { towerIds: string[], confirmations: string[], district?,
 *         alertId?, testOnly? }
 * Network blasts (>1 tower) require 2 confirmations (two-person rule);
 * the route returns 422 with the refusal otherwise.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(TRIGGER_ROLES);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const limit = triggerLimiter(`sirens-trigger:${ip}`);
  if (!limit.success) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded — 5 siren triggers per minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const towerIds = Array.isArray(body.towerIds)
    ? body.towerIds.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  const confirmations = Array.isArray(body.confirmations)
    ? body.confirmations.filter((c): c is string => typeof c === "string" && c.trim().length > 0)
    : [];
  if (towerIds.length === 0) {
    return NextResponse.json({ ok: false, error: "towerIds is required." }, { status: 400 });
  }

  const result = await triggerSirens({
    towerIds,
    confirmations,
    district: typeof body.district === "string" ? body.district : undefined,
    alertId: typeof body.alertId === "string" ? body.alertId : undefined,
    testOnly: body.testOnly === true,
  });

  if (!result.ok && result.activationId === null && result.sounded === 0 && result.failed > 0) {
    // Policy refusal (two-person rule / empty list) → 422, not 500.
    if (result.detail.includes("Two-person") || result.detail.includes("No towers")) {
      return NextResponse.json(
        {
          ok: false,
          sounded: result.sounded,
          failed: result.failed,
          activationId: result.activationId,
          detail: result.detail,
        },
        { status: 422 },
      );
    }
  }
  return NextResponse.json({
    ok: result.ok,
    sounded: result.sounded,
    failed: result.failed,
    activationId: result.activationId,
    detail: result.detail,
  });
}
