import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/security/require-role";
import { createRateLimiter } from "@/lib/security/rate-limit";
import { standDownSirens } from "@/lib/sirens/controller";

export const dynamic = "force-dynamic";

const TRIGGER_ROLES = ["super_admin", "district_admin"] as const;

const standDownLimiter = createRateLimiter(10, 60_000);

/**
 * POST /api/sirens/stand-down — all-clear (no two-person rule).
 * Body: { towerIds: string[] }
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
  const limit = standDownLimiter(`sirens-standdown:${ip}`);
  if (!limit.success) {
    return NextResponse.json({ ok: false, error: "Rate limit exceeded." }, { status: 429 });
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
  if (towerIds.length === 0) {
    return NextResponse.json({ ok: false, error: "towerIds is required." }, { status: 400 });
  }

  const result = await standDownSirens(towerIds);
  return NextResponse.json({
    ok: result.ok,
    sounded: result.sounded,
    failed: result.failed,
    activationId: result.activationId,
    detail: result.detail,
  });
}
